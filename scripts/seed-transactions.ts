/**
 * Seed script — processes CSV1+CSV2 pairs directly from disk.
 * Run: npx tsx scripts/seed-transactions.ts
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parseCsv1, parseCsv2 } from '../lib/ingestion/parse'
import { joinCsvs } from '../lib/ingestion/join'
import { computeRfmScores } from '../lib/ingestion/rfm'
import { assignSegment } from '../lib/ingestion/segments'
import { deriveDrinkProfile } from '../lib/ingestion/drink-profile'
import { computeTriggers } from '../lib/ingestion/triggers'
import { resolveTemplate } from '../lib/templates'
import type { Customer, JourneyLogEntry } from '../lib/types'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const PAIRS: [string, string][] = [
  ['orders_export_20260603_150939.csv', 'orders_export_20260603_150942.csv'],
  ['orders_export_20260603_150758.csv', 'orders_export_20260603_150800.csv'],
  ['orders_export_20260603_150216.csv', 'orders_export_20260603_150219.csv'],
  ['orders_export_20260603_144344.csv', 'orders_export_20260603_144347.csv'],
]

const DOWNLOADS = path.join(process.env.HOME!, 'Downloads')

function normaliseMY(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return '60' + digits
}

async function processPair(csv1File: string, csv2File: string, pairIdx: number) {
  const label = `Pair ${pairIdx + 1} (${csv1File} + ${csv2File})`
  console.log(`\n──────────────────────────────────────`)
  console.log(`Processing ${label}`)

  const text1 = fs.readFileSync(path.join(DOWNLOADS, csv1File), 'utf8')
  const text2 = fs.readFileSync(path.join(DOWNLOADS, csv2File), 'utf8')

  const csv1 = parseCsv1(text1)
  const csv2 = parseCsv2(text2)
  console.log(`  CSV1 rows: ${csv1.length}  CSV2 rows: ${csv2.length}`)

  // Resolve customer identities from DB (batch to avoid URL length limits)
  const mobiles = [...new Set(csv1.map(r => normaliseMY(r['Mobile #'] || '')).filter(Boolean))]
  const BATCH = 500
  const customerRows: { crm_id: string; mobile: string | null; first_name: string | null; last_name: string | null; segment: string | null; points_balance: number; points_prev_balance: number; voucher_redeemed: number }[] = []
  for (let i = 0; i < mobiles.length; i += BATCH) {
    const chunk = mobiles.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('customers')
      .select('crm_id, mobile, first_name, last_name, segment, points_balance, points_prev_balance, voucher_redeemed')
      .in('mobile', chunk)
    if (error) throw new Error(`Customer lookup failed: ${error.message}`)
    if (data) customerRows.push(...data)
  }

  const customerMeta = new Map<string, typeof customerRows extends (infer T)[] | null ? T : never>()
  for (const c of customerRows ?? []) {
    if (c.mobile) customerMeta.set(c.crm_id, c)
  }

  const syntheticCsv3 = (customerRows ?? []).map(c => ({
    id: c.crm_id, crm_id: c.crm_id,
    'First Name': c.first_name ?? '', 'Middle Name': '', 'Last Name': c.last_name ?? '',
    'Email': '', 'Mobile Number': c.mobile ?? '', 'Current Loc Code': '',
    'Is Active': '1',
    'Cashback Rewards Points': String(c.points_balance ?? 0),
    'Cashback Prev Rewards Points': String(c.points_prev_balance ?? 0),
    'Welcome Voucher': String(c.voucher_redeemed ?? 0), 'Created at': '',
  }))

  const joined = joinCsvs(csv1, csv2, syntheticCsv3)
  console.log(`  Matched customers: ${joined.customerTransactions.size}  Unknown transactions: ${joined.unknownTransactions.length}`)
  if (joined.unknownTransactions.length) {
    console.log(`  ⚠ ${joined.unknownTransactions.length} txns had no matching customer (upload customer CSV3 first)`)
  }

  const today = new Date()
  const allCustomerIds = [...joined.customerTransactions.keys()]
  if (allCustomerIds.length === 0) {
    console.log(`  ⚠ No matched customers — skipping DB writes`)
    return
  }

  // Batch all subsequent lookups by customer ID
  const existingCustomers: { crm_id: string; segment: string | null; total_visits: number; last_visit_date: string | null; avg_gap_days: number | null; points_balance: number; outlet_count: number; avg_item_quantity: number; favourite_item: string | null; favourite_outlet: string | null }[] = []
  const historicTxns: { customer_id: string; transaction_date: string | null; outlet_code: string | null; net_sales: number }[] = []
  const journeyRows: { customer_id: string; message_template: string; action_date: string }[] = []

  for (let i = 0; i < allCustomerIds.length; i += BATCH) {
    const chunk = allCustomerIds.slice(i, i + BATCH)
    const [ec, ht, jr] = await Promise.all([
      supabase.from('customers').select('crm_id, segment, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, avg_item_quantity, favourite_item, favourite_outlet').in('crm_id', chunk),
      supabase.from('transactions').select('customer_id, transaction_date, outlet_code, net_sales').in('customer_id', chunk),
      supabase.from('journey_log').select('customer_id, message_template, action_date').in('customer_id', chunk),
    ])
    if (ec.data) existingCustomers.push(...ec.data)
    if (ht.data) historicTxns.push(...ht.data)
    if (jr.data) journeyRows.push(...jr.data)
  }

  const existingById = new Map(existingCustomers.map(c => [c.crm_id, c]))

  const journeyByCustomer = new Map<string, Array<{ template: string; days_ago: number }>>()
  for (const row of journeyRows ?? []) {
    const days = Math.floor((today.getTime() - new Date(row.action_date).getTime()) / 86_400_000)
    const arr = journeyByCustomer.get(row.customer_id) ?? []
    arr.push({ template: row.message_template, days_ago: days })
    journeyByCustomer.set(row.customer_id, arr)
  }

  const customersToUpsert: Partial<Customer>[] = []
  const drinkProfilesToUpsert: Record<string, unknown>[] = []
  const txnsToInsert: Record<string, unknown>[] = []
  const billItemsToInsert: Record<string, unknown>[] = []
  const segmentHistoryToInsert: Record<string, unknown>[] = []
  const journalEntriesToInsert: JourneyLogEntry[] = []
  let actionsGenerated = 0
  let segmentChanges = 0

  for (const [customerId, txns] of joined.customerTransactions) {
    const meta = customerMeta.get(customerId)
    const historic = (historicTxns ?? []).filter(t => t.customer_id === customerId)
    const allTxns = [
      ...historic.map(t => ({ transaction_date: t.transaction_date, outlet_code: t.outlet_code, net_sales: t.net_sales })),
      ...txns.map(t => ({ transaction_date: t.transaction_date, outlet_code: t.outlet_code, net_sales: t.net_sales })),
    ]
    const sorted = allTxns.filter(t => t.transaction_date)
      .sort((a, b) => new Date(a.transaction_date!).getTime() - new Date(b.transaction_date!).getTime())

    const totalVisits = sorted.length
    const lastVisit  = sorted.at(-1)?.transaction_date ?? null
    const firstVisit = sorted.at(0)?.transaction_date ?? null

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++)
      gaps.push(Math.floor((new Date(sorted[i].transaction_date!).getTime() - new Date(sorted[i-1].transaction_date!).getTime()) / 86_400_000))
    const avgGap    = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
    const v1ToV2Gap = gaps[0] ?? null

    const cutoff60   = new Date(today.getTime() - 60 * 86_400_000)
    const visits60   = sorted.filter(t => new Date(t.transaction_date!) >= cutoff60)
    const gaps60: number[] = []
    for (let i = 1; i < visits60.length; i++)
      gaps60.push(Math.floor((new Date(visits60[i].transaction_date!).getTime() - new Date(visits60[i-1].transaction_date!).getTime()) / 86_400_000))
    const maxGap60 = gaps60.length ? Math.max(...gaps60) : 0
    const visits90 = sorted.filter(t => new Date(t.transaction_date!) >= new Date(today.getTime() - 90 * 86_400_000)).length

    const outletCodes = new Set(allTxns.map(t => t.outlet_code).filter(Boolean) as string[])
    const avgSpend    = totalVisits > 0 ? allTxns.reduce((s, t) => s + (t.net_sales ?? 0), 0) / totalVisits : 0
    const daysSinceLast = lastVisit ? Math.floor((today.getTime() - new Date(lastVisit).getTime()) / 86_400_000) : 9999

    const billItems   = joined.customerBillItems.get(customerId) ?? []
    const parentItems = billItems.filter(i => !i.is_modifier)
    const avgItemQty  = parentItems.length > 0 ? parentItems.reduce((s, i) => s + i.item_qty, 0) / parentItems.length : 0
    const hasBigOrder = parentItems.some(i => i.item_qty >= 5)

    const prevPointsBalance = meta?.points_balance ?? 0
    const pointsAwarded     = billItems.reduce((s, i) => s + i.point_awarded, 0)
    const pointsRedeemed    = billItems.reduce((s, i) => s + i.point_redeemed, 0)
    const pointsBalance     = Math.max(0, prevPointsBalance + pointsAwarded - pointsRedeemed)
    const voucherRedeemed   = meta?.voucher_redeemed ?? 0

    const favouriteOutlet = [...outletCodes]
      .map(code => ({ code, count: allTxns.filter(t => t.outlet_code === code).length }))
      .sort((a, b) => b.count - a.count)[0]?.code ?? null
    const drinkProfile = deriveDrinkProfile(billItems)

    const existingOutlets = new Set((historicTxns ?? []).filter(t => t.customer_id === customerId).map(t => t.outlet_code))
    const newOutletVisited = [...outletCodes].some(o => !existingOutlets.has(o))
    const prevRedeemed = (historicTxns ?? []).filter(t => t.customer_id === customerId).length > 0
    const thisRedeemed = billItems.reduce((s, i) => s + i.point_redeemed, 0) > 0
    const firstRedemptionThisUpload = !prevRedeemed && thisRedeemed
    const largeBillTxns = txns.filter(tx => {
      const items = billItems.filter(i => i.transaction_id === tx.koppiku_ref && !i.is_modifier)
      return items.some(i => i.item_qty >= 5)
    })
    const largeOrderDaysAgo = largeBillTxns.length > 0
      ? Math.floor((today.getTime() - new Date(largeBillTxns[0].transaction_date!).getTime()) / 86_400_000)
      : null

    const segment = assignSegment({
      crm_id: customerId,
      total_visits: totalVisits,
      last_visit_days_ago: daysSinceLast,
    })

    const prior = existingById.get(customerId)
    if (prior?.segment && prior.segment !== segment) {
      segmentHistoryToInsert.push({
        customer_id: customerId, old_segment: prior.segment, new_segment: segment,
        changed_date: today.toISOString().slice(0, 10),
      })
      segmentChanges++
    }

    customersToUpsert.push({
      crm_id: customerId, segment,
      rfm_r: null, rfm_f: null, rfm_m: null,
      points_balance: pointsBalance, points_prev_balance: prevPointsBalance,
      total_visits: totalVisits, last_visit_date: lastVisit, first_visit_date: firstVisit,
      avg_gap_days: avgGap || null, v1_to_v2_gap: v1ToV2Gap,
      outlet_count: outletCodes.size, avg_item_quantity: avgItemQty,
      favourite_item: drinkProfile.favourite_drink, favourite_outlet: favouriteOutlet,
      last_updated: today.toISOString(),
    })

    drinkProfilesToUpsert.push({ customer_id: customerId, ...drinkProfile, last_updated: today.toISOString() })
    txnsToInsert.push(...(txns as unknown as Record<string, unknown>[]))
    billItemsToInsert.push(...(billItems as unknown as Record<string, unknown>[]))

    const triggered = computeTriggers({
      crm_id: customerId, segment, days_since_last_visit: daysSinceLast,
      total_visits: totalVisits, points_balance: pointsBalance, avg_spend: avgSpend,
      registered_days_ago: 9999, last_actions: journeyByCustomer.get(customerId) ?? [],
    }, today)

    for (const action of triggered) {
      const vars: Record<string, string> = {
        favourite_item: drinkProfile.favourite_drink ?? '', points_balance: String(pointsBalance),
        points_to_reward: String(Math.max(0, 100 - pointsBalance)), outlet_count: String(outletCodes.size),
        total_visits: String(totalVisits), monthly_points: String(billItems.reduce((s, i) => s + i.point_awarded, 0)),
        favourite_outlet: favouriteOutlet ?? '', expiring_points: String(pointsBalance),
        monthly_news: 'Check out our new seasonal menu!',
        referral_code: `KOPPIKU-${customerId.slice(-6).toUpperCase()}`,
        first_name: meta?.first_name ?? '', redeemable_drinks: '1',
      }
      journalEntriesToInsert.push({
        customer_id: customerId, action_date: today.toISOString().slice(0, 10),
        action_type: action.action_type, channel: action.channel,
        message_template: action.template, resolved_message: resolveTemplate(action.template, vars),
        completed: 0, outcome: null,
      })
    }
    actionsGenerated += triggered.length
  }

  // RFM scoring
  const rfmInputs = customersToUpsert
    .filter(c => c.last_visit_date)
    .map(c => ({
      crm_id: c.crm_id!,
      last_visit_date: c.last_visit_date!,
      visits_in_last_90_days: c.total_visits ?? 0,
      avg_spend: (c.total_visits ?? 0) > 0 ? (existingById.get(c.crm_id!)?.points_balance ?? 0) / (c.total_visits ?? 1) : 0,
    }))
  const rfmScores = computeRfmScores(rfmInputs)
  for (const c of customersToUpsert) {
    const s = rfmScores.get(c.crm_id!)
    if (s) { c.rfm_r = s.rfm_r; c.rfm_f = s.rfm_f; c.rfm_m = s.rfm_m }
  }

  // Write to Supabase
  const errors: string[] = []
  if (customersToUpsert.length) {
    const { error } = await supabase.from('customers').upsert(customersToUpsert as unknown[], { onConflict: 'crm_id' })
    if (error) errors.push(`customers: ${error.message}`)
  }
  if (drinkProfilesToUpsert.length)
    await supabase.from('drink_profiles').upsert(drinkProfilesToUpsert, { onConflict: 'customer_id' })
  if (txnsToInsert.length)
    await supabase.from('transactions').upsert(txnsToInsert as unknown[], { onConflict: 'koppiku_ref', ignoreDuplicates: true })
  if (billItemsToInsert.length)
    await supabase.from('bill_items').insert(billItemsToInsert as unknown[])
  if (segmentHistoryToInsert.length)
    await supabase.from('segment_history').insert(segmentHistoryToInsert as unknown[])
  if (journalEntriesToInsert.length)
    await supabase.from('journey_log').insert(journalEntriesToInsert)

  await supabase.from('upload_log').insert([
    { file_type: 'transactions', row_count: csv1.length, status: errors.length ? 'partial' : 'success', error_message: errors[0] ?? null },
    { file_type: 'line_items',   row_count: csv2.length, status: errors.length ? 'partial' : 'success', error_message: errors[0] ?? null },
  ])

  console.log(`  ✓ Customers updated:  ${customersToUpsert.length}`)
  console.log(`  ✓ Transactions:       ${txnsToInsert.length}`)
  console.log(`  ✓ Bill items:         ${billItemsToInsert.length}`)
  console.log(`  ✓ Segment changes:    ${segmentChanges}`)
  console.log(`  ✓ Actions generated:  ${actionsGenerated}`)
  if (errors.length) console.log(`  ✗ Errors: ${errors.join(', ')}`)
}

async function main() {
  console.log('Project Vision — Transaction Seed Script')
  console.log(`Processing ${PAIRS.length} CSV pairs...\n`)

  for (let i = 0; i < PAIRS.length; i++) {
    const [csv1, csv2] = PAIRS[i]
    await processPair(csv1, csv2, i)
  }

  console.log('\n──────────────────────────────────────')
  console.log('Done.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
