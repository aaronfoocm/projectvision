'use server'

import { parseCsv1, parseCsv2, parseCsv3, detectMissingColumns } from '@/lib/ingestion/parse'
import { joinCsvs } from '@/lib/ingestion/join'
import { computeRfmScores } from '@/lib/ingestion/rfm'
import { assignSegment } from '@/lib/ingestion/segments'
import { deriveDrinkProfile } from '@/lib/ingestion/drink-profile'
import { computeTriggers } from '@/lib/ingestion/triggers'
import { resolveTemplate } from '@/lib/templates'
import { createServiceClient } from '@/lib/supabase/service'
import type { UploadSummary, Customer, JourneyLogEntry } from '@/lib/types'

const BUCKET = 'csv-uploads'

const CSV1_REQUIRED = ['Date', 'Koppiku Ref #', 'Mobile #', 'Location', 'Net Sales']
const CSV2_REQUIRED = ['Koppiku Ref #', 'Item', 'Code', 'Order Start Time', 'Item Qty']
const CSV3_REQUIRED = ['crm_id', 'Mobile Number', 'Cashback Rewards Points']

// ─── Signed upload URL ────────────────────────────────────────────────────────
export async function getUploadUrl(filename: string): Promise<{ token: string; path: string }> {
  const supabase = createServiceClient()
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${Date.now()}-${safe}`

  const { data: bucket } = await supabase.storage.getBucket(BUCKET)
  if (!bucket) {
    await supabase.storage.createBucket(BUCKET, { public: false })
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`)
  return { token: data.token, path: data.path }
}

async function downloadFromStorage(supabase: ReturnType<typeof createServiceClient>, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Could not download file: ${error?.message}`)
  return data.text()
}

// ─── CSV3: Customer master file ───────────────────────────────────────────────
export interface CustomerUploadResult {
  totalProcessed: number
  newCustomers: number
  errors: string[]
}

export async function ingestCustomers(storagePath: string): Promise<CustomerUploadResult> {
  const errors: string[] = []
  const result: CustomerUploadResult = { totalProcessed: 0, newCustomers: 0, errors }

  try {
    const supabase = createServiceClient()

    const text = await downloadFromStorage(supabase, storagePath)
    const csv3 = parseCsv3(text)
    await supabase.storage.from(BUCKET).remove([storagePath])

    if (csv3.length === 0) { errors.push('File appears empty or could not be parsed.'); return result }

    const missing = detectMissingColumns(csv3 as unknown as Record<string, string>[], CSV3_REQUIRED)
    if (missing.length) errors.push(`Missing columns: ${missing.join(', ')}`)

    // Fetch existing to detect new customers
    const { data: existing } = await supabase.from('customers').select('crm_id')
    const existingIds = new Set((existing ?? []).map(c => c.crm_id))

    const today = new Date().toISOString()

    // Deduplicate by crm_id — keep last occurrence
    const seen = new Map<string, typeof csv3[0]>()
    for (const row of csv3) {
      const id = row.crm_id || row.id
      if (id) seen.set(id, row)
    }

    // Build upsert rows — only include columns we're updating, preserving segment/rfm
    const customersToUpsert = [...seen.values()]
      .map(row => {
        const crmId = row.crm_id || row.id
        if (!crmId) return null
        if (!existingIds.has(crmId)) result.newCustomers++
        return {
          crm_id: crmId,
          mobile: (row['Mobile Number'] ?? '').replace(/^\+/, '').replace(/\s/g, '') || null,
          first_name: row['First Name'] || null,
          last_name: row['Last Name'] || null,
          email: row['Email'] || null,
          points_balance: parseFloat(row['Cashback Rewards Points']) || 0,
          points_prev_balance: parseFloat(row['Cashback Prev Rewards Points']) || 0,
          current_loc_code: row['Current Loc Code'] || null,
          is_active: parseInt(row['Is Active'] ?? '1') || 1,
          last_updated: today,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (customersToUpsert.length) {
      const { error } = await supabase
        .from('customers')
        .upsert(customersToUpsert, { onConflict: 'crm_id' })
      if (error) errors.push(`Database error: ${error.message}`)
    }

    await supabase.from('upload_log').insert([{
      file_type: 'customers',
      row_count: csv3.length,
      status: errors.length ? 'partial' : 'success',
      error_message: errors[0] ?? null,
    }])

    result.totalProcessed = customersToUpsert.length
  } catch (e) {
    errors.push(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`)
  }

  return result
}

// ─── CSV1 + CSV2: Daily transaction pair ─────────────────────────────────────
export async function ingestTransactions(storagePath1: string, storagePath2: string): Promise<UploadSummary> {
  const supabase = createServiceClient()
  const today = new Date()
  const errors: string[] = []
  const summary: UploadSummary = { totalProcessed: 0, newCustomers: 0, segmentChanges: [], actionsGenerated: 0, errors }

  const [text1, text2] = await Promise.all([
    downloadFromStorage(supabase, storagePath1),
    downloadFromStorage(supabase, storagePath2),
  ])
  await supabase.storage.from(BUCKET).remove([storagePath1, storagePath2])
  const csv1 = parseCsv1(text1)
  const csv2 = parseCsv2(text2)

  const missing1 = detectMissingColumns(csv1 as unknown as Record<string, string>[], CSV1_REQUIRED)
  const missing2 = detectMissingColumns(csv2 as unknown as Record<string, string>[], CSV2_REQUIRED)
  if (missing1.length) errors.push(`Transactions missing columns: ${missing1.join(', ')}`)
  if (missing2.length) errors.push(`Line items missing columns: ${missing2.join(', ')}`)

  // ── Resolve customer identity from DB (not from CSV3) ──────────────────────
  // Get all unique mobiles from CSV1
  const mobiles = [...new Set(
    csv1.map(r => (r['Mobile #'] || '').replace(/^\+/, '').replace(/\s/g, '')).filter(Boolean)
  )]

  // Lookup customers by mobile
  const { data: customerRows } = await supabase
    .from('customers')
    .select('crm_id, mobile, first_name, last_name, segment, points_balance, points_prev_balance, voucher_redeemed')
    .in('mobile', mobiles)

  const mobileToId = new Map<string, string>()
  const customerMeta = new Map<string, typeof customerRows extends (infer T)[] | null ? T : never>()
  for (const c of customerRows ?? []) {
    if (c.mobile) {
      mobileToId.set(c.mobile, c.crm_id)
      customerMeta.set(c.crm_id, c)
    }
  }

  // Build a synthetic CSV3 from DB data so we can reuse joinCsvs
  // We only need crm_id + mobile for joining — other fields come from DB
  const syntheticCsv3 = (customerRows ?? []).map(c => ({
    id: c.crm_id,
    crm_id: c.crm_id,
    'First Name': c.first_name ?? '',
    'Middle Name': '',
    'Last Name': c.last_name ?? '',
    'Email': '',
    'Mobile Number': c.mobile ?? '',
    'Current Loc Code': '',
    'Is Active': '1',
    'Cashback Rewards Points': String(c.points_balance ?? 0),
    'Cashback Prev Rewards Points': String(c.points_prev_balance ?? 0),
    'Welcome Voucher': String(c.voucher_redeemed ?? 0),
    'Created at': '',
  }))

  const joined = joinCsvs(csv1, csv2, syntheticCsv3)

  if (joined.unknownTransactions.length) {
    errors.push(`${joined.unknownTransactions.length} transaction(s) had no matching customer in DB — upload customer file first.`)
  }

  // ── Fetch historical data ──────────────────────────────────────────────────
  const allCustomerIds = [...joined.customerTransactions.keys()]

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('crm_id, segment, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, avg_item_quantity, favourite_item, favourite_outlet')
    .in('crm_id', allCustomerIds)
  const existingById = new Map((existingCustomers ?? []).map(c => [c.crm_id, c]))

  const { data: historicTxns } = await supabase
    .from('transactions')
    .select('customer_id, transaction_date, outlet_code, net_sales')
    .in('customer_id', allCustomerIds)

  const { data: journeyRows } = await supabase
    .from('journey_log')
    .select('customer_id, message_template, action_date')
    .in('customer_id', allCustomerIds)

  const journeyByCustomer = new Map<string, Array<{ template: string; days_ago: number }>>()
  for (const row of journeyRows ?? []) {
    const days = Math.floor((today.getTime() - new Date(row.action_date).getTime()) / 86_400_000)
    const arr = journeyByCustomer.get(row.customer_id) ?? []
    arr.push({ template: row.message_template, days_ago: days })
    journeyByCustomer.set(row.customer_id, arr)
  }

  // ── Per-customer processing ────────────────────────────────────────────────
  const customersToUpsert: Partial<Customer>[] = []
  const drinkProfilesToUpsert: Record<string, unknown>[] = []
  const txnsToInsert: Record<string, unknown>[] = []
  const billItemsToInsert: Record<string, unknown>[] = []
  const segmentHistoryToInsert: Record<string, unknown>[] = []
  const journalEntriesToInsert: JourneyLogEntry[] = []

  for (const [customerId, txns] of joined.customerTransactions) {
    const dbCustomer = existingById.get(customerId)
    const meta = customerMeta.get(customerId)

    const historic = (historicTxns ?? []).filter(t => t.customer_id === customerId)
    const allTxns = [
      ...historic.map(t => ({ transaction_date: t.transaction_date, outlet_code: t.outlet_code, net_sales: t.net_sales })),
      ...txns.map(t => ({ transaction_date: t.transaction_date, outlet_code: t.outlet_code, net_sales: t.net_sales })),
    ]

    const sorted = allTxns
      .filter(t => t.transaction_date)
      .sort((a, b) => new Date(a.transaction_date!).getTime() - new Date(b.transaction_date!).getTime())

    const totalVisits = sorted.length
    const lastVisit = sorted.at(-1)?.transaction_date ?? null
    const firstVisit = sorted.at(0)?.transaction_date ?? null

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.floor((new Date(sorted[i].transaction_date!).getTime() - new Date(sorted[i - 1].transaction_date!).getTime()) / 86_400_000))
    }
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
    const v1ToV2Gap = gaps[0] ?? null

    const cutoff60 = new Date(today.getTime() - 60 * 86_400_000)
    const visits60 = sorted.filter(t => new Date(t.transaction_date!) >= cutoff60)
    const gaps60: number[] = []
    for (let i = 1; i < visits60.length; i++) {
      gaps60.push(Math.floor((new Date(visits60[i].transaction_date!).getTime() - new Date(visits60[i - 1].transaction_date!).getTime()) / 86_400_000))
    }
    const maxGap60 = gaps60.length ? Math.max(...gaps60) : 0

    const cutoff90 = new Date(today.getTime() - 90 * 86_400_000)
    const visits90 = sorted.filter(t => new Date(t.transaction_date!) >= cutoff90).length

    const outletCodes = new Set(allTxns.map(t => t.outlet_code).filter(Boolean) as string[])
    const avgSpend = totalVisits > 0 ? allTxns.reduce((s, t) => s + (t.net_sales ?? 0), 0) / totalVisits : 0
    const daysSinceLast = lastVisit ? Math.floor((today.getTime() - new Date(lastVisit).getTime()) / 86_400_000) : 9999

    const billItems = joined.customerBillItems.get(customerId) ?? []
    const parentItems = billItems.filter(i => !i.is_modifier)
    const avgItemQty = parentItems.length > 0 ? parentItems.reduce((s, i) => s + i.item_qty, 0) / parentItems.length : 0
    const hasBigOrder = parentItems.some(i => i.item_qty >= 5)

    const pointsBalance = meta?.points_balance ?? 0
    const voucherRedeemed = meta?.voucher_redeemed ?? 0

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

    const registeredDaysAgo = 9999

    const segment = assignSegment({
      crm_id: customerId, total_visits: totalVisits, outlet_count: outletCodes.size,
      visits_last_60_days: visits60.length, max_gap_last_60_days: maxGap60,
      last_visit_days_ago: daysSinceLast, avg_gap_days: avgGap,
      points_balance: pointsBalance, voucher_redeemed: voucherRedeemed,
      avg_item_quantity: avgItemQty, has_bill_with_qty_5_plus: hasBigOrder,
      registered_days_ago: registeredDaysAgo,
    })

    const prior = dbCustomer
    if (prior && prior.segment && prior.segment !== segment) {
      segmentHistoryToInsert.push({
        customer_id: customerId, old_segment: prior.segment, new_segment: segment,
        changed_date: today.toISOString().slice(0, 10),
      })
      summary.segmentChanges.push({
        customerId,
        name: [meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || customerId,
        from: prior.segment, to: segment,
      })
    }

    customersToUpsert.push({
      crm_id: customerId,
      segment,
      rfm_r: null, rfm_f: null, rfm_m: null,
      total_visits: totalVisits,
      last_visit_date: lastVisit,
      first_visit_date: firstVisit,
      avg_gap_days: avgGap || null,
      v1_to_v2_gap: v1ToV2Gap,
      outlet_count: outletCodes.size,
      avg_item_quantity: avgItemQty,
      favourite_item: drinkProfile.favourite_drink,
      favourite_outlet: favouriteOutlet,
      last_updated: today.toISOString(),
    })

    drinkProfilesToUpsert.push({ customer_id: customerId, ...drinkProfile, last_updated: today.toISOString() })
    txnsToInsert.push(...(txns as unknown as Record<string, unknown>[]))
    billItemsToInsert.push(...(billItems as unknown as Record<string, unknown>[]))

    const lastActions = journeyByCustomer.get(customerId) ?? []
    const triggered = computeTriggers({
      crm_id: customerId, segment, days_since_last_visit: daysSinceLast, avg_gap_days: avgGap,
      total_visits: totalVisits, points_balance: pointsBalance, avg_spend: avgSpend,
      total_visits_all_time: totalVisits, registered_days_ago: registeredDaysAgo,
      last_actions: lastActions, new_outlet_visited: newOutletVisited,
      large_order_days_ago: largeOrderDaysAgo, avg_item_quantity: avgItemQty,
      first_redemption_this_upload: firstRedemptionThisUpload,
    }, today)

    for (const action of triggered) {
      const vars: Record<string, string> = {
        favourite_item: drinkProfile.favourite_drink ?? '',
        points_balance: String(pointsBalance),
        points_to_reward: String(Math.max(0, 100 - pointsBalance)),
        outlet_count: String(outletCodes.size),
        total_visits: String(totalVisits),
        monthly_points: String(billItems.reduce((s, i) => s + i.point_awarded, 0)),
        favourite_outlet: favouriteOutlet ?? '',
        expiring_points: String(pointsBalance),
        monthly_news: 'Check out our new seasonal menu!',
        referral_code: `KOPPIKU-${customerId.slice(-6).toUpperCase()}`,
        first_name: meta?.first_name ?? '',
        redeemable_drinks: '1',
      }
      journalEntriesToInsert.push({
        customer_id: customerId, action_date: today.toISOString().slice(0, 10),
        action_type: action.action_type, channel: action.channel,
        message_template: action.template, resolved_message: resolveTemplate(action.template, vars),
        completed: 0, outcome: null,
      })
    }
    summary.actionsGenerated += triggered.length
  }

  // ── RFM across all processed customers ────────────────────────────────────
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

  // ── Write to Supabase ──────────────────────────────────────────────────────
  if (customersToUpsert.length) {
    const { error } = await supabase.from('customers').upsert(customersToUpsert as unknown[], { onConflict: 'crm_id' })
    if (error) errors.push(`customers upsert: ${error.message}`)
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
    { file_type: 'transactions', row_count: csv1.length, status: 'success' },
    { file_type: 'line_items', row_count: csv2.length, status: 'success' },
  ])

  summary.totalProcessed = customersToUpsert.length
  return summary
}

// ─── Redemption menu ──────────────────────────────────────────────────────────
export async function ingestRedemptionMenu(storagePath: string): Promise<{ count: number; error?: string }> {
  const supabase = createServiceClient()
  const text = await downloadFromStorage(supabase, storagePath)
  await supabase.storage.from(BUCKET).remove([storagePath])
  const { parseCsv1 } = await import('@/lib/ingestion/parse')
  const rows = parseCsv1(text) as unknown as Array<{ item_code: string; item_name: string; points_required: string }>
  const items = rows.map(r => ({ item_code: r.item_code, item_name: r.item_name, points_required: parseInt(r.points_required) || 0 }))
  const { error } = await supabase.from('redemption_menu').upsert(items, { onConflict: 'item_code' })
  if (error) return { count: 0, error: error.message }
  return { count: items.length }
}
