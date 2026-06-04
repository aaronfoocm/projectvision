import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

async function fetchAll(queryFn) {
  const PAGE = 1000
  let from = 0, all = []
  while (true) {
    const { data, error } = await queryFn(from, from + PAGE - 1)
    if (error) { console.error(error.message); break }
    all.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Drink profile logic (mirrors lib/ingestion/drink-profile.ts) ──────────────
const MILK_KEYWORDS = ['coconut milk', 'oat milk', 'full cream', 'soy milk', 'skim milk', 'almond milk']
const SIZE_KEYWORDS = ['regular', 'large', 'small']

function getTimeSlot(time) {
  const hour = parseInt(time.split(':')[0], 10)
  if (hour >= 6 && hour < 11) return 'MORNING'
  if (hour >= 11 && hour < 15) return 'AFTERNOON'
  if (hour >= 15 && hour < 20) return 'EVENING'
  return 'NIGHT'
}

function mostFrequent(arr) {
  if (!arr.length) return null
  const counts = new Map()
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function deriveDrinkProfile(items) {
  const parents = items.filter(i => !i.is_modifier)
  const modifiers = items.filter(i => i.is_modifier)

  let iced = 0, hot = 0
  for (const p of parents) {
    if (p.item_name?.includes('(ICED)')) iced++
    else if (p.item_name?.includes('(HOT)')) hot++
  }
  const preferred_temp = (iced > 0 || hot > 0)
    ? (iced === hot ? 'BOTH' : iced > hot ? 'ICED' : 'HOT')
    : null

  const slots = parents.filter(p => p.order_start_time).map(p => getTimeSlot(p.order_start_time))
  const preferred_time_slot = mostFrequent(slots)

  const milks = modifiers
    .filter(m => MILK_KEYWORDS.some(k => m.modifier_name?.toLowerCase().includes(k)))
    .map(m => m.modifier_name)
  const preferred_milk = mostFrequent(milks)

  const sizes = modifiers
    .filter(m => SIZE_KEYWORDS.some(k => m.modifier_name?.toLowerCase().includes(k)))
    .map(m => m.modifier_name)
  const preferred_size = mostFrequent(sizes)

  const favourite_drink = mostFrequent(parents.map(p => p.item_name).filter(Boolean))

  const others = modifiers.filter(m => {
    const name = m.modifier_name?.toLowerCase() ?? ''
    return !MILK_KEYWORDS.some(k => name.includes(k)) && !SIZE_KEYWORDS.includes(name)
  })
  const otherCounts = new Map()
  for (const m of others) {
    if (m.modifier_name) otherCounts.set(m.modifier_name, (otherCounts.get(m.modifier_name) ?? 0) + 1)
  }
  const top2 = [...otherCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])

  return { favourite_drink, preferred_temp, preferred_time_slot, preferred_milk, preferred_size, top_modifier_1: top2[0] ?? null, top_modifier_2: top2[1] ?? null }
}

// ── Load data ─────────────────────────────────────────────────────────────────
console.log('▶ Fetching transactions …')
const txns = await fetchAll((f, t) =>
  sb.from('transactions').select('koppiku_ref, customer_id').not('customer_id', 'is', null).range(f, t)
)
const refToCustomer = new Map(txns.map(t => [t.koppiku_ref, t.customer_id]))
console.log(`  ${txns.length} transactions`)

console.log('▶ Fetching bill items …')
const items = await fetchAll((f, t) =>
  sb.from('bill_items')
    .select('transaction_id, item_name, item_code, order_start_time, is_modifier, modifier_name')
    .range(f, t)
)
console.log(`  ${items.length} bill items`)

// ── Group items by customer ───────────────────────────────────────────────────
const itemsByCustomer = new Map()
for (const item of items) {
  const customerId = refToCustomer.get(item.transaction_id)
  if (!customerId) continue
  const arr = itemsByCustomer.get(customerId) ?? []
  arr.push(item)
  itemsByCustomer.set(customerId, arr)
}
console.log(`  ${itemsByCustomer.size} customers with bill items`)

// ── Compute and upsert ────────────────────────────────────────────────────────
const profiles = []
const now = new Date().toISOString()
for (const [customerId, customerItems] of itemsByCustomer) {
  const profile = deriveDrinkProfile(customerItems)
  profiles.push({ customer_id: customerId, ...profile, last_updated: now })
}

console.log(`\n▶ Upserting ${profiles.length} drink profiles …`)
for (let i = 0; i < profiles.length; i += 500) {
  const batch = profiles.slice(i, i + 500)
  const { error } = await sb.from('drink_profiles').upsert(batch, { onConflict: 'customer_id' })
  if (error) console.error(`  ✗ ${error.message}`)
  process.stdout.write(`\r  ${Math.min(i + 500, profiles.length)}/${profiles.length}`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
const withDrink = profiles.filter(p => p.favourite_drink).length
const withTemp = profiles.filter(p => p.preferred_temp).length
const withMilk = profiles.filter(p => p.preferred_milk).length
const temps = { ICED: 0, HOT: 0, BOTH: 0 }
for (const p of profiles) if (p.preferred_temp) temps[p.preferred_temp]++

console.log(`\n\n✅ Done.`)
console.log(`  ${withDrink} with favourite drink`)
console.log(`  ${withTemp} with temp pref — ICED: ${temps.ICED} / HOT: ${temps.HOT} / BOTH: ${temps.BOTH}`)
console.log(`  ${withMilk} with milk preference`)
