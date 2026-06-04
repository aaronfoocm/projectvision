/**
 * Recalculates total_visits, last_visit_date, first_visit_date for every customer
 * from the actual transactions table. Fixes the truncation bug from the seed script.
 *
 * Run: npx tsx scripts/fix-total-visits.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)
const PAGE = 1000

async function main() {
  console.log('Fetching all customer IDs...')

  // Paginate through all customers
  const allCustomers: { crm_id: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('customers')
      .select('crm_id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`customers fetch: ${error.message}`)
    if (!data || data.length === 0) break
    allCustomers.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Total customers: ${allCustomers.length}`)

  // Paginate through all transactions and build a map of customer_id → {count, min, max}
  console.log('Fetching all transactions...')
  const stats = new Map<string, { count: number; min: string; max: string }>()
  from = 0
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('customer_id, transaction_date')
      .not('customer_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`transactions fetch: ${error.message}`)
    if (!data || data.length === 0) break
    for (const t of data) {
      const id  = t.customer_id as string
      const dt  = t.transaction_date as string
      const cur = stats.get(id)
      if (!cur) {
        stats.set(id, { count: 1, min: dt, max: dt })
      } else {
        cur.count++
        if (dt < cur.min) cur.min = dt
        if (dt > cur.max) cur.max = dt
      }
    }
    console.log(`  ...${from + data.length} transactions loaded`)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Unique customers with transactions: ${stats.size}`)

  // Build update payloads and upsert in batches of 200
  const updates = allCustomers
    .map(c => {
      const s = stats.get(c.crm_id)
      return s
        ? { crm_id: c.crm_id, total_visits: s.count, first_visit_date: s.min, last_visit_date: s.max }
        : null
    })
    .filter(Boolean) as { crm_id: string; total_visits: number; first_visit_date: string; last_visit_date: string }[]

  console.log(`Updating ${updates.length} customers...`)
  const BATCH = 200
  let updated = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH)
    const { error } = await sb
      .from('customers')
      .upsert(chunk, { onConflict: 'crm_id' })
    if (error) throw new Error(`upsert error: ${error.message}`)
    updated += chunk.length
    process.stdout.write(`\r  Updated ${updated} / ${updates.length}`)
  }
  console.log('\nDone.')

  // Verify the specific customer
  const { data: check } = await sb
    .from('customers')
    .select('crm_id, total_visits, first_visit_date, last_visit_date')
    .eq('crm_id', '994ed5fc-859c-4b08-87ca-8ee8793c7792')
    .single()
  console.log('\nVerification for 994ed5fc:', JSON.stringify(check))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
