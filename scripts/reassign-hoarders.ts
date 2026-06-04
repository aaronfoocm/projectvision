/**
 * Reassigns customers with segment='Hoarder' to their next applicable segment.
 * Uses fields available in the customers table (no need for full re-ingestion).
 * Run: npx tsx scripts/reassign-hoarders.ts
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://vpvolbqgnwgwflikdryd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
)

const today = new Date()

function daysSince(d: string | null): number {
  if (!d) return 9999
  return Math.floor((today.getTime() - new Date(d).getTime()) / 86_400_000)
}

function reassign(c: {
  total_visits: number; outlet_count: number; avg_gap_days: number | null
  last_visit_date: string | null; avg_item_quantity: number
}): string {
  const daysSinceLast = daysSince(c.last_visit_date)
  const avgGap = c.avg_gap_days ?? 0

  // Explorer: visited 3+ outlets with 3+ total visits
  if (c.outlet_count >= 3 && c.total_visits >= 3) return 'Explorer'
  // Regular: visited recently and has many visits (proxy for visits_last_60_days)
  if (c.total_visits >= 3 && daysSinceLast <= 60) return 'Regular'
  // GroupBuyer: avg_item_quantity >= 3 (proxy for has_bill_with_qty_5_plus)
  if (c.avg_item_quantity >= 3) return 'GroupBuyer'
  // Flickerer: 2-4 visits, gap widening
  if (c.total_visits >= 2 && c.total_visits <= 4 && avgGap > 0 && daysSinceLast > avgGap * 1.5 && daysSinceLast > 45) return 'Flickerer'
  // Ghost: only 1 visit or very lapsed
  if (c.total_visits === 1 || (daysSinceLast > 90 && c.total_visits < 5)) return 'Ghost'
  // Active multi-visit customers that don't fit above — call them Regular
  if (c.total_visits >= 3 && daysSinceLast <= 180) return 'Regular'
  return 'Ghost'
}

async function main() {
  const { data: hoarders, error } = await sb
    .from('customers')
    .select('crm_id, total_visits, outlet_count, avg_gap_days, last_visit_date, avg_item_quantity, segment')
    .eq('segment', 'Hoarder')
  if (error) throw error

  console.log(`Found ${hoarders!.length} Hoarder customers`)

  const dist: Record<string, number> = {}
  const updates = hoarders!.map(c => {
    const newSeg = reassign(c)
    dist[newSeg] = (dist[newSeg] ?? 0) + 1
    return { crm_id: c.crm_id, segment: newSeg, last_updated: today.toISOString() }
  })

  console.log('New segment distribution:', JSON.stringify(dist))

  // Update in batches of 200
  const BATCH = 200
  let updated = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: upErr } = await sb.from('customers')
      .upsert(updates.slice(i, i + BATCH), { onConflict: 'crm_id' })
    if (upErr) throw upErr
    updated += Math.min(BATCH, updates.length - i)
    process.stdout.write(`\r  Updated ${updated} / ${updates.length}`)
  }
  console.log('\nDone.')

  // Verify the example user
  const { data: check } = await sb.from('customers')
    .select('crm_id, segment').eq('crm_id', 'ebdd26fc-890a-4ad8-8a85-71aa0f01c268').single()
  console.log('Verification (ebdd26fc):', JSON.stringify(check))
}
main().catch(e => { console.error(e); process.exit(1) })
