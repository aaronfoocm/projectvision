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

// Canonical Malaysian mobile format: 60XXXXXXXXX (no + prefix)
function normaliseMY(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return '60' + digits
}

const BUCKET = 'csv-uploads'

const CSV1_REQUIRED = ['Date', 'Koppiku Ref #', 'Mobile #', 'Location', 'Net Sales']
const CSV2_REQUIRED = ['Koppiku Ref #', 'Item', 'Code', 'Order Start Time', 'Item Qty']
const CSV3_REQUIRED = ['crm_id', 'Mobile Number', 'Cashback Rewards Points']

// ─── Signed upload URL ────────────────────────────────────────────────────────
export async function getUploadUrl(filename: string): Promise<{ signedUrl: string; path: string }> {
  const supabase = createServiceClient()
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${Date.now()}-${safe}`

  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket(BUCKET)
  if (!bucket) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: false })
    if (createErr) throw new Error(`Could not create storage bucket: ${createErr.message}`)
  } else if (bucketErr) {
    throw new Error(`Could not access storage bucket: ${String(bucketErr)}`)
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`)
  return { signedUrl: data.signedUrl, path: data.path }
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

export type CustomerBatchRow = {
  crm_id: string
  mobile: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  points_balance: number
  points_prev_balance: number
  is_active: number
  current_loc_code: string | null
}

// Called once before batching to get existing IDs for new-customer detection
export async function getExistingCustomerIds(): Promise<string[]> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('customers').select('crm_id')
  return (data ?? []).map(c => c.crm_id)
}

export async function batchIngestCustomers(
  rows: CustomerBatchRow[],
  isLast: boolean,
  rowCount: number,
): Promise<{ processed: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  const today = new Date().toISOString()

  const toUpsert = rows.map(r => ({
    crm_id: r.crm_id,
    mobile: r.mobile,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    is_active: r.is_active,
    current_loc_code: r.current_loc_code,
    last_updated: today,
  }))

  const { error } = await supabase.from('customers').upsert(toUpsert, { onConflict: 'crm_id' })
  if (error) errors.push(`Database error: ${error.message}`)

  if (isLast) {
    await supabase.from('upload_log').insert([{
      file_type: 'customers',
      row_count: rowCount,
      status: errors.length ? 'partial' : 'success',
      error_message: errors[0] ?? null,
    }])
  }

  return { processed: rows.length, errors }
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
    csv1.map(r => normaliseMY(r['Mobile #'] || '')).filter(Boolean)
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

  // Paginate all three lookups — default PostgREST cap is 1000 rows which would
  // silently truncate data for large batches and produce wrong total_visits counts.
  const PAGE = 1000
  type ExistingCustomer = { crm_id: string; segment: string | null; total_visits: number; last_visit_date: string | null; avg_gap_days: number | null; points_balance: number; outlet_count: number; avg_item_quantity: number; favourite_item: string | null; favourite_outlet: string | null }
  type HistoricTxn = { customer_id: string; transaction_date: string | null; outlet_code: string | null; net_sales: number }
  type JourneyRow = { customer_id: string; message_template: string; action_date: string }

  const existingCustomers: ExistingCustomer[] = []
  const historicTxns: HistoricTxn[] = []
  const journeyRows: JourneyRow[] = []

  for (let i = 0; i < allCustomerIds.length; i += PAGE) {
    const chunk = allCustomerIds.slice(i, i + PAGE)
    const [ec, ht, jr] = await Promise.all([
      supabase.from('customers')
        .select('crm_id, segment, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, avg_item_quantity, favourite_item, favourite_outlet')
        .in('crm_id', chunk),
      supabase.from('transactions')
        .select('customer_id, transaction_date, outlet_code, net_sales')
        .in('customer_id', chunk)
        .limit(100_000),
      supabase.from('journey_log')
        .select('customer_id, message_template, action_date')
        .in('customer_id', chunk),
    ])
    if (ec.data) existingCustomers.push(...ec.data as ExistingCustomer[])
    if (ht.data) historicTxns.push(...ht.data as HistoricTxn[])
    if (jr.data) journeyRows.push(...jr.data as JourneyRow[])
  }

  const existingById = new Map(existingCustomers.map(c => [c.crm_id, c]))

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
  const visits60Map = new Map<string, number>()

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
    visits60Map.set(customerId, visits60.length)
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

    const prevPointsBalance = meta?.points_balance ?? 0
    const pointsAwarded = billItems.reduce((s, i) => s + i.point_awarded, 0)
    const pointsRedeemed = billItems.reduce((s, i) => s + i.point_redeemed, 0)
    const pointsBalance = Math.max(0, prevPointsBalance + pointsAwarded - pointsRedeemed)
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
      crm_id: customerId,
      total_visits: totalVisits,
      last_visit_days_ago: daysSinceLast,
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
      points_balance: pointsBalance,
      points_prev_balance: prevPointsBalance,
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
      crm_id: customerId, segment, days_since_last_visit: daysSinceLast,
      total_visits: totalVisits, points_balance: pointsBalance, avg_spend: avgSpend,
      registered_days_ago: registeredDaysAgo, last_actions: lastActions,
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
      visits_in_last_60_days: visits60Map.get(c.crm_id!) ?? 0,
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
