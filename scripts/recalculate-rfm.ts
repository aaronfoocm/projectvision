/**
 * Globally recalculates RFM scores for all customers using new fixed thresholds:
 *   R — days since last_visit_date (fixed bands: ≤7/8-14/15-30/31-60/60+)
 *   F — visits in last 60 days (fixed bands: 0/1/2-3/4-7/8+)
 *   M — avg net_sales per visit (relative quintile across all customers)
 *
 * Run: npx tsx scripts/recalculate-rfm.ts
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://vpvolbqgnwgwflikdryd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
)

const PAGE = 1000
const today = new Date()
today.setHours(0, 0, 0, 0)
const cutoff60 = new Date(today.getTime() - 60 * 86_400_000)

function daysSince(iso: string): number {
  return Math.floor((today.getTime() - new Date(iso).getTime()) / 86_400_000)
}

function rScore(daysAgo: number): number {
  if (daysAgo <= 7) return 5
  if (daysAgo <= 14) return 4
  if (daysAgo <= 30) return 3
  if (daysAgo <= 60) return 2
  return 1
}

function fScore(visits60: number): number {
  if (visits60 >= 8) return 5
  if (visits60 >= 4) return 4
  if (visits60 >= 2) return 3
  if (visits60 >= 1) return 2
  return 1
}

function quintile(value: number, sorted: number[], higherIsBetter: boolean): number {
  if (sorted.length === 0) return 3
  const rank = sorted.filter(v => v <= value).length
  const pct  = rank / sorted.length
  const raw  = Math.max(1, Math.ceil(pct * 5))
  return higherIsBetter ? raw : 6 - raw
}

async function main() {
  const startedAt = Date.now()

  // ── Step 1: Load all customers with visits ─────────────────────────────────
  console.log('Loading customers...')
  const customers: { crm_id: string; last_visit_date: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('customers')
      .select('crm_id, last_visit_date')
      .not('last_visit_date', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    customers.push(...data as typeof customers)
    process.stdout.write(`\r  Loaded ${customers.length} customers`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`\n  ${customers.length} customers with a last visit`)

  // ── Step 2: Load all transactions to compute 60-day visits + avg spend ─────
  console.log('Loading transactions...')
  const custData = new Map<string, { sales: number; count: number; visits60: number }>()
  from = 0
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('customer_id, transaction_date, net_sales')
      .not('customer_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const t of data) {
      const cur = custData.get(t.customer_id) ?? { sales: 0, count: 0, visits60: 0 }
      cur.sales += t.net_sales ?? 0
      cur.count += 1
      if (t.transaction_date && new Date(t.transaction_date) >= cutoff60) cur.visits60 += 1
      custData.set(t.customer_id, cur)
    }
    process.stdout.write(`\r  Loaded ${from + data.length} transactions`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log()

  // ── Step 3: Build inputs ───────────────────────────────────────────────────
  const inputs = customers.map(c => {
    const d = custData.get(c.crm_id)
    return {
      crm_id:    c.crm_id,
      daysAgo:   daysSince(c.last_visit_date),
      visits60:  d?.visits60 ?? 0,
      avgSpend:  d && d.count > 0 ? d.sales / d.count : 0,
    }
  })

  // ── Step 4: Compute global M quintiles ────────────────────────────────────
  const monetaries = inputs.map(i => i.avgSpend).sort((a, b) => a - b)

  // ── Step 5: Score every customer ──────────────────────────────────────────
  const updates = inputs.map(i => ({
    crm_id:       i.crm_id,
    rfm_r:        rScore(i.daysAgo),
    rfm_f:        fScore(i.visits60),
    rfm_m:        quintile(i.avgSpend, monetaries, true),
    last_updated: today.toISOString(),
  }))

  // Print score distribution for reference
  const rDist: Record<number, number> = {}
  const fDist: Record<number, number> = {}
  for (const u of updates) {
    rDist[u.rfm_r] = (rDist[u.rfm_r] ?? 0) + 1
    fDist[u.rfm_f] = (fDist[u.rfm_f] ?? 0) + 1
  }
  console.log('\nR score distribution:', JSON.stringify(rDist))
  console.log('F score distribution:', JSON.stringify(fDist))

  // ── Step 5b: NeverTransacted customers get R1 F1 M1 ─────────────────────
  console.log('\nSetting R1 F1 M1 for NeverTransacted customers (no last_visit_date)...')
  const { error: ntError } = await sb
    .from('customers')
    .update({ rfm_r: 1, rfm_f: 1, rfm_m: 1, last_updated: today.toISOString() })
    .is('last_visit_date', null)
  if (ntError) throw new Error(`NeverTransacted update: ${ntError.message}`)

  // ── Step 6: Upsert in batches ─────────────────────────────────────────────
  console.log(`Updating ${updates.length} customers with visits...`)
  const BATCH = 500
  let done = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await sb
      .from('customers')
      .upsert(updates.slice(i, i + BATCH), { onConflict: 'crm_id' })
    if (error) throw new Error(`upsert: ${error.message}`)
    done += Math.min(BATCH, updates.length - i)
    process.stdout.write(`\r  Updated ${done} / ${updates.length}`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n\n✅ Done in ${elapsed}s.`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
