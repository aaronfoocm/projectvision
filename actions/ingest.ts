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

const CSV1_REQUIRED = ['Date', 'Koppiku Ref #', 'Mobile #', 'Location', 'Net Sales']
const CSV2_REQUIRED = ['Koppiku Ref #', 'Item', 'Code', 'Order Start Time', 'Item Qty']
const CSV3_REQUIRED = ['crm_id', 'Mobile Number', 'Cashback Rewards Points']

export async function ingestCsvs(formData: FormData): Promise<UploadSummary> {
  const supabase = createServiceClient()
  const today = new Date()
  const errors: string[] = []
  const summary: UploadSummary = {
    totalProcessed: 0, newCustomers: 0, segmentChanges: [], actionsGenerated: 0, errors,
  }

  const file1 = formData.get('csv1') as File | null
  const file2 = formData.get('csv2') as File | null
  const file3 = formData.get('csv3') as File | null
  if (!file1 || !file2 || !file3) {
    errors.push('All 3 CSV files are required.')
    return summary
  }

  const [text1, text2, text3] = await Promise.all([file1.text(), file2.text(), file3.text()])
  const csv1 = parseCsv1(text1)
  const csv2 = parseCsv2(text2)
  const csv3 = parseCsv3(text3)

  const missing1 = detectMissingColumns(csv1 as unknown as Record<string, string>[], CSV1_REQUIRED)
  const missing2 = detectMissingColumns(csv2 as unknown as Record<string, string>[], CSV2_REQUIRED)
  const missing3 = detectMissingColumns(csv3 as unknown as Record<string, string>[], CSV3_REQUIRED)
  if (missing1.length) errors.push(`CSV1 missing columns: ${missing1.join(', ')}`)
  if (missing2.length) errors.push(`CSV2 missing columns: ${missing2.join(', ')}`)
  if (missing3.length) errors.push(`CSV3 missing columns: ${missing3.join(', ')}`)

  const joined = joinCsvs(csv1, csv2, csv3)
  if (joined.unknownTransactions.length) {
    errors.push(`${joined.unknownTransactions.length} transaction(s) had no matching customer mobile — skipped.`)
  }

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('crm_id, segment, total_visits, last_visit_date, avg_gap_days, points_balance')
  const existingById = new Map((existingCustomers ?? []).map(c => [c.crm_id, c]))

  const allCustomerIds = [...new Set([...joined.customerTransactions.keys(), ...joined.customerById.keys()])]

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

  const customersToUpsert: Customer[] = []
  const drinkProfilesToUpsert: Record<string, unknown>[] = []
  const txnsToInsert: Record<string, unknown>[] = []
  const billItemsToInsert: Record<string, unknown>[] = []
  const segmentHistoryToInsert: Record<string, unknown>[] = []
  const journalEntriesToInsert: JourneyLogEntry[] = []
  const processedIds = new Set<string>()

  for (const [customerId, txns] of joined.customerTransactions) {
    processedIds.add(customerId)
    const csv3Row = joined.customerById.get(customerId)
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

    const pointsBalance = parseFloat(csv3Row?.['Cashback Rewards Points'] ?? '0') || 0
    const pointsPrev = parseFloat(csv3Row?.['Cashback Prev Rewards Points'] ?? '0') || 0
    const voucherRedeemed = parseInt(csv3Row?.['Welcome Voucher'] ?? '0') || 0

    const favouriteOutlet = [...outletCodes]
      .map(code => ({ code, count: allTxns.filter(t => t.outlet_code === code).length }))
      .sort((a, b) => b.count - a.count)[0]?.code ?? null

    const drinkProfile = deriveDrinkProfile(billItems)
    const createdAt = csv3Row?.['Created at']
    const registeredDaysAgo = createdAt ? Math.floor((today.getTime() - new Date(createdAt).getTime()) / 86_400_000) : 9999

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
      crm_id: customerId, total_visits: totalVisits, outlet_count: outletCodes.size,
      visits_last_60_days: visits60.length, max_gap_last_60_days: maxGap60,
      last_visit_days_ago: daysSinceLast, avg_gap_days: avgGap,
      points_balance: pointsBalance, voucher_redeemed: voucherRedeemed,
      avg_item_quantity: avgItemQty, has_bill_with_qty_5_plus: hasBigOrder,
      registered_days_ago: registeredDaysAgo,
    })

    const prior = existingById.get(customerId)
    if (prior && prior.segment !== segment) {
      segmentHistoryToInsert.push({ customer_id: customerId, old_segment: prior.segment, new_segment: segment, changed_date: today.toISOString().slice(0, 10) })
      summary.segmentChanges.push({
        customerId, name: `${csv3Row?.['First Name'] ?? ''} ${csv3Row?.['Last Name'] ?? ''}`.trim() || customerId,
        from: prior.segment, to: segment,
      })
    }
    if (!prior) summary.newCustomers++

    const customer: Customer = {
      crm_id: customerId, mobile: csv3Row?.['Mobile Number'] ?? null,
      first_name: csv3Row?.['First Name'] ?? null, last_name: csv3Row?.['Last Name'] ?? null,
      email: csv3Row?.['Email'] ?? null, segment,
      rfm_r: null, rfm_f: null, rfm_m: null,
      total_visits: totalVisits, last_visit_date: lastVisit, first_visit_date: firstVisit,
      avg_gap_days: avgGap || null, v1_to_v2_gap: v1ToV2Gap,
      points_balance: pointsBalance, points_prev_balance: pointsPrev,
      voucher_redeemed: voucherRedeemed, outlet_count: outletCodes.size,
      avg_item_quantity: avgItemQty, favourite_item: drinkProfile.favourite_drink,
      favourite_outlet: favouriteOutlet, current_loc_code: csv3Row?.['Current Loc Code'] ?? null,
      is_active: parseInt(csv3Row?.['Is Active'] ?? '1') || 1, last_updated: today.toISOString(),
    }
    customersToUpsert.push(customer)
    drinkProfilesToUpsert.push({ customer_id: customerId, ...drinkProfile, last_updated: today.toISOString() })
    txnsToInsert.push(...txns)
    billItemsToInsert.push(...billItems)

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
        first_name: csv3Row?.['First Name'] ?? '',
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

  // Dormant customers — in CSV3 but no transactions
  for (const crmId of joined.customerById.keys()) {
    if (processedIds.has(crmId)) continue
    const csv3Row = joined.customerById.get(crmId)!
    const createdAt = csv3Row['Created at']
    const registeredDaysAgo = createdAt ? Math.floor((today.getTime() - new Date(createdAt).getTime()) / 86_400_000) : 0
    const prior = existingById.get(crmId)
    if (!prior) summary.newCustomers++

    const customer: Customer = {
      crm_id: crmId, mobile: csv3Row['Mobile Number'] ?? null,
      first_name: csv3Row['First Name'] ?? null, last_name: csv3Row['Last Name'] ?? null,
      email: csv3Row['Email'] ?? null, segment: 'Dormant',
      rfm_r: null, rfm_f: null, rfm_m: null,
      total_visits: 0, last_visit_date: null, first_visit_date: null,
      avg_gap_days: null, v1_to_v2_gap: null,
      points_balance: parseFloat(csv3Row['Cashback Rewards Points']) || 0,
      points_prev_balance: parseFloat(csv3Row['Cashback Prev Rewards Points']) || 0,
      voucher_redeemed: 0, outlet_count: 0, avg_item_quantity: 0,
      favourite_item: null, favourite_outlet: null,
      current_loc_code: csv3Row['Current Loc Code'] ?? null,
      is_active: parseInt(csv3Row['Is Active']) || 1, last_updated: today.toISOString(),
    }
    customersToUpsert.push(customer)

    const lastActions = journeyByCustomer.get(crmId) ?? []
    const triggered = computeTriggers({
      crm_id: crmId, segment: 'Dormant', days_since_last_visit: 9999, avg_gap_days: 0,
      total_visits: 0, points_balance: 0, avg_spend: 0, total_visits_all_time: 0,
      registered_days_ago: registeredDaysAgo, last_actions: lastActions,
      new_outlet_visited: false, large_order_days_ago: null, avg_item_quantity: 0,
      first_redemption_this_upload: false,
    }, today)
    for (const action of triggered) {
      journalEntriesToInsert.push({
        customer_id: crmId, action_date: today.toISOString().slice(0, 10),
        action_type: action.action_type, channel: action.channel,
        message_template: action.template,
        resolved_message: resolveTemplate(action.template, { first_name: csv3Row['First Name'] ?? '' }),
        completed: 0, outcome: null,
      })
    }
    summary.actionsGenerated += triggered.length
  }

  // RFM scoring across all processed customers
  const rfmInputs = customersToUpsert
    .filter(c => c.last_visit_date)
    .map(c => ({
      crm_id: c.crm_id, last_visit_date: c.last_visit_date,
      visits_in_last_90_days: c.total_visits,
      avg_spend: c.total_visits > 0 ? c.points_balance / c.total_visits : 0,
    }))
  const rfmScores = computeRfmScores(rfmInputs)
  for (const c of customersToUpsert) {
    const s = rfmScores.get(c.crm_id)
    if (s) { c.rfm_r = s.rfm_r; c.rfm_f = s.rfm_f; c.rfm_m = s.rfm_m }
  }

  // Write to Supabase
  const { error: custErr } = await supabase.from('customers').upsert(customersToUpsert, { onConflict: 'crm_id' })
  if (custErr) errors.push(`customers upsert: ${custErr.message}`)

  if (drinkProfilesToUpsert.length) {
    await supabase.from('drink_profiles').upsert(drinkProfilesToUpsert, { onConflict: 'customer_id' })
  }
  if (txnsToInsert.length) {
    await supabase.from('transactions').upsert(txnsToInsert, { onConflict: 'koppiku_ref', ignoreDuplicates: true })
  }
  if (billItemsToInsert.length) {
    await supabase.from('bill_items').insert(billItemsToInsert)
  }
  if (segmentHistoryToInsert.length) {
    await supabase.from('segment_history').insert(segmentHistoryToInsert)
  }
  if (journalEntriesToInsert.length) {
    await supabase.from('journey_log').insert(journalEntriesToInsert)
  }

  await supabase.from('upload_log').insert([
    { file_type: 'transactions', row_count: csv1.length, status: 'success' },
    { file_type: 'line_items', row_count: csv2.length, status: 'success' },
    { file_type: 'customers', row_count: csv3.length, status: 'success' },
  ])

  summary.totalProcessed = customersToUpsert.length
  return summary
}

export async function ingestRedemptionMenu(formData: FormData): Promise<{ count: number; error?: string }> {
  const supabase = createServiceClient()
  const file = formData.get('redemption_menu') as File | null
  if (!file) return { count: 0, error: 'No file provided' }
  const text = await file.text()
  const { parseCsv1 } = await import('@/lib/ingestion/parse')
  const rows = parseCsv1(text) as unknown as Array<{ item_code: string; item_name: string; points_required: string }>
  const items = rows.map(r => ({
    item_code: r.item_code, item_name: r.item_name,
    points_required: parseInt(r.points_required) || 0,
  }))
  const { error } = await supabase.from('redemption_menu').upsert(items, { onConflict: 'item_code' })
  if (error) return { count: 0, error: error.message }
  return { count: items.length }
}
