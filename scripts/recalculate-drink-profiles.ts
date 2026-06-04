/**
 * Full recalculation of ALL drink profile fields from complete bill_items history.
 * Updates: favourite_drink, preferred_temp, preferred_time_slot, preferred_milk,
 *          preferred_size, top_modifier_1, top_modifier_2
 *
 * Run: npx tsx scripts/recalculate-drink-profiles.ts
 */
import { createClient } from '@supabase/supabase-js'
import { deriveDrinkProfile } from '../lib/ingestion/drink-profile'
import type { BillItem } from '../lib/types'

const sb = createClient(
  'https://vpvolbqgnwgwflikdryd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
)

const PAGE = 1000

async function main() {
  const startedAt = Date.now()

  // ── Step 1: Build transaction_id → customer_id map ────────────────────────
  console.log('Loading transactions...')
  const refToCust = new Map<string, string>()
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('koppiku_ref, customer_id')
      .not('customer_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`transactions: ${error.message}`)
    if (!data || data.length === 0) break
    for (const t of data) refToCust.set(t.koppiku_ref, t.customer_id)
    process.stdout.write(`\r  Loaded ${from + data.length} transactions`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`\n  ${refToCust.size} unique transaction refs across ${new Set(refToCust.values()).size} customers`)

  // ── Step 2: Load all bill items and group by customer ─────────────────────
  console.log('Loading bill items...')
  const custItems = new Map<string, BillItem[]>()
  from = 0
  while (true) {
    const { data, error } = await sb
      .from('bill_items')
      .select('transaction_id, item_name, item_code, order_start_time, item_qty, net_sales, point_awarded, point_redeemed, is_modifier, parent_item_code, modifier_name')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`bill_items: ${error.message}`)
    if (!data || data.length === 0) break
    for (const item of data) {
      const custId = refToCust.get(item.transaction_id)
      if (!custId) continue
      const arr = custItems.get(custId) ?? []
      arr.push(item as BillItem)
      custItems.set(custId, arr)
    }
    process.stdout.write(`\r  Loaded ${from + data.length} bill items`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`\n  ${custItems.size} customers with item history`)

  // ── Step 3: Derive drink profiles ─────────────────────────────────────────
  console.log('Computing drink profiles...')
  const updates: Record<string, unknown>[] = []
  const now = new Date().toISOString()

  for (const [custId, items] of custItems) {
    const profile = deriveDrinkProfile(items)
    updates.push({ customer_id: custId, ...profile, last_updated: now })
  }
  console.log(`  ${updates.length} profiles computed`)

  // ── Step 4: Upsert in batches ─────────────────────────────────────────────
  console.log('Upserting drink profiles...')
  const BATCH = 200
  let done = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await sb
      .from('drink_profiles')
      .upsert(updates.slice(i, i + BATCH), { onConflict: 'customer_id' })
    if (error) throw new Error(`upsert: ${error.message}`)
    done += Math.min(BATCH, updates.length - i)
    process.stdout.write(`\r  Upserted ${done} / ${updates.length}`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\nDone in ${elapsed}s.`)

  // ── Verify the example customer ────────────────────────────────────────────
  const { data: check } = await sb
    .from('drink_profiles')
    .select('customer_id, favourite_drink, preferred_temp, preferred_time_slot, preferred_milk, preferred_size')
    .eq('customer_id', 'ebdd26fc-890a-4ad8-8a85-71aa0f01c268')
    .single()
  console.log('\nVerification (ebdd26fc):', JSON.stringify(check, null, 2))
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
