/**
 * Recalculates favourite_drink for all customers from their full bill_items history.
 * Fixes the bug where favourite_drink was only computed from the last ingested CSV batch.
 *
 * Run: npx tsx scripts/fix-drink-profiles.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function mostFrequent<T>(arr: T[]): T | null {
  if (!arr.length) return null
  const counts = new Map<T, number>()
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

const PAGE = 1000

async function main() {
  console.log('Loading all transactions...')

  // Build customer_id → koppiku_refs map
  const custRefs = new Map<string, string[]>()
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('customer_id, koppiku_ref')
      .not('customer_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const t of data) {
      const arr = custRefs.get(t.customer_id) ?? []
      arr.push(t.koppiku_ref)
      custRefs.set(t.customer_id, arr)
    }
    process.stdout.write(`\r  Transactions loaded: ${from + data.length}`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`\nCustomers with transactions: ${custRefs.size}`)

  // Build transaction_id → customer_id reverse map for bill_items join
  const refToCust = new Map<string, string>()
  for (const [custId, refs] of custRefs) {
    for (const ref of refs) refToCust.set(ref, custId)
  }

  // Load all non-modifier bill items and compute item counts per customer
  console.log('Loading bill items...')
  const custItemCounts = new Map<string, Map<string, number>>()
  from = 0
  while (true) {
    const { data, error } = await sb
      .from('bill_items')
      .select('transaction_id, item_name, item_qty')
      .eq('is_modifier', false)
      .not('item_name', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const item of data) {
      const custId = refToCust.get(item.transaction_id)
      if (!custId || !item.item_name) continue
      const counts = custItemCounts.get(custId) ?? new Map<string, number>()
      counts.set(item.item_name, (counts.get(item.item_name) ?? 0) + (item.item_qty ?? 1))
      custItemCounts.set(custId, counts)
    }
    process.stdout.write(`\r  Bill items loaded: ${from + data.length}`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`\nCustomers with item history: ${custItemCounts.size}`)

  // Build updates
  const updates: { customer_id: string; favourite_drink: string }[] = []
  for (const [custId, counts] of custItemCounts) {
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top) updates.push({ customer_id: custId, favourite_drink: top[0] })
  }
  console.log(`Updating ${updates.length} drink profiles...`)

  const BATCH = 200
  let updated = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH)
    const { error } = await sb
      .from('drink_profiles')
      .upsert(chunk, { onConflict: 'customer_id' })
    if (error) throw new Error(`upsert error: ${error.message}`)
    updated += chunk.length
    process.stdout.write(`\r  Updated ${updated} / ${updates.length}`)
  }
  console.log('\nDone.')

  // Verify the specific customer
  const { data: check } = await sb.from('drink_profiles')
    .select('customer_id, favourite_drink')
    .eq('customer_id', 'ebdd26fc-890a-4ad8-8a85-71aa0f01c268')
    .single()
  console.log('\nVerification (ebdd26fc):', JSON.stringify(check))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
