/**
 * Retroactively compute segments + stats for every customer who has transactions.
 * Run once after initial seeding.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Pagination helper (bypasses 1000-row cap) ─────────────────────────────────
async function fetchAll(query) {
  const PAGE = 1000
  let from = 0
  const all = []
  while (true) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) { console.error(error.message); break }
    all.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Segment assignment (mirrors lib/ingestion/segments.ts logic) ──────────────
function assignSegment(p) {
  const {
    total_visits, outlet_count, visits_last_60_days, max_gap_last_60_days,
    last_visit_days_ago, avg_gap_days, points_balance, voucher_redeemed,
    avg_item_quantity, has_bill_with_qty_5_plus, registered_days_ago,
  } = p

  if (total_visits === 0) return 'Ghost'
  if (last_visit_days_ago > 90) return 'Dormant'
  if (has_bill_with_qty_5_plus || avg_item_quantity >= 4) return 'GroupBuyer'
  if (points_balance >= 80 && total_visits >= 5) return 'Hoarder'
  if (outlet_count >= 3 || (outlet_count >= 2 && total_visits >= 6)) return 'Explorer'
  if (visits_last_60_days >= 4 && max_gap_last_60_days <= 21) return 'Regular'
  if (visits_last_60_days >= 2 && max_gap_last_60_days <= 30) return 'Flickerer'
  if (total_visits >= 2) return 'Flickerer'
  return 'Ghost'
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('▶ Fetching all transactions …')
const allTxns = await fetchAll((from, to) =>
  sb.from('transactions')
    .select('koppiku_ref, customer_id, transaction_date, outlet_code, net_sales')
    .not('customer_id', 'is', null)
    .range(from, to)
)
console.log(`  ${allTxns.length} transactions loaded`)

// Group transactions by customer
const txnsByCustomer = new Map()
for (const t of allTxns) {
  const arr = txnsByCustomer.get(t.customer_id) ?? []
  arr.push(t)
  txnsByCustomer.set(t.customer_id, arr)
}

console.log(`▶ Fetching all bill items …`)
const allItems = await fetchAll((from, to) =>
  sb.from('bill_items')
    .select('transaction_id, item_qty, point_awarded, point_redeemed, is_modifier')
    .range(from, to)
)
console.log(`  ${allItems.length} bill items loaded`)

// Map bill items by transaction ref
const itemsByRef = new Map()
for (const item of allItems) {
  const arr = itemsByRef.get(item.transaction_id) ?? []
  arr.push(item)
  itemsByRef.set(item.transaction_id, arr)
}

// ── Per-customer computation ───────────────────────────────────────────────────
const today = new Date()
today.setHours(0, 0, 0, 0)

const updates = []

for (const [customerId, txns] of txnsByCustomer) {
  const sorted = txns
    .filter(t => t.transaction_date)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())

  const totalVisits = sorted.length
  const lastVisit = sorted.at(-1)?.transaction_date ?? null
  const firstVisit = sorted.at(0)?.transaction_date ?? null
  const daysSinceLast = lastVisit
    ? Math.floor((today.getTime() - new Date(lastVisit).getTime()) / 86_400_000)
    : 9999

  const gaps = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.floor(
      (new Date(sorted[i].transaction_date).getTime() - new Date(sorted[i - 1].transaction_date).getTime()) / 86_400_000
    ))
  }
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0

  const cutoff60 = new Date(today.getTime() - 60 * 86_400_000)
  const visits60 = sorted.filter(t => new Date(t.transaction_date) >= cutoff60)
  const gaps60 = []
  for (let i = 1; i < visits60.length; i++) {
    gaps60.push(Math.floor(
      (new Date(visits60[i].transaction_date).getTime() - new Date(visits60[i - 1].transaction_date).getTime()) / 86_400_000
    ))
  }
  const maxGap60 = gaps60.length ? Math.max(...gaps60) : 0

  const outletCodes = new Set(txns.map(t => t.outlet_code).filter(Boolean))

  const billItems = txns.flatMap(t => itemsByRef.get(t.koppiku_ref) ?? [])
  const parentItems = billItems.filter(i => !i.is_modifier)
  const avgItemQty = parentItems.length > 0
    ? parentItems.reduce((s, i) => s + (i.item_qty ?? 0), 0) / parentItems.length
    : 0
  const hasBigOrder = parentItems.some(i => (i.item_qty ?? 0) >= 5)
  const pointsBalance = Math.max(0,
    billItems.reduce((s, i) => s + (i.point_awarded ?? 0) - (i.point_redeemed ?? 0), 0)
  )
  const avgSpend = totalVisits > 0
    ? txns.reduce((s, t) => s + (t.net_sales ?? 0), 0) / totalVisits
    : 0

  const segment = assignSegment({
    crm_id: customerId,
    total_visits: totalVisits,
    outlet_count: outletCodes.size,
    visits_last_60_days: visits60.length,
    max_gap_last_60_days: maxGap60,
    last_visit_days_ago: daysSinceLast,
    avg_gap_days: avgGap,
    points_balance: pointsBalance,
    voucher_redeemed: 0,
    avg_item_quantity: avgItemQty,
    has_bill_with_qty_5_plus: hasBigOrder,
    registered_days_ago: 9999,
  })

  updates.push({
    crm_id: customerId,
    segment,
    total_visits: totalVisits,
    last_visit_date: lastVisit ? new Date(lastVisit).toISOString() : null,
    first_visit_date: firstVisit ? new Date(firstVisit).toISOString() : null,
    avg_gap_days: avgGap || null,
    outlet_count: outletCodes.size,
    avg_item_quantity: avgItemQty,
    points_balance: pointsBalance,
    last_updated: today.toISOString(),
  })
}

console.log(`▶ Upserting segments for ${updates.length} customers …`)
for (let i = 0; i < updates.length; i += 500) {
  const batch = updates.slice(i, i + 500)
  const { error } = await sb.from('customers').upsert(batch, { onConflict: 'crm_id' })
  if (error) console.error(`  ✗ ${error.message}`)
  process.stdout.write(`\r  ${Math.min(i + 500, updates.length)}/${updates.length}`)
}
console.log('\n\n✅ Segments computed.')

// Quick summary
const breakdown = {}
for (const u of updates) breakdown[u.segment] = (breakdown[u.segment] ?? 0) + 1
console.log('Segment breakdown:', breakdown)
