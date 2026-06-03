import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CustomerCard } from '@/components/customers/CustomerCard'
import { SearchBar } from '@/components/customers/SearchBar'
import type { Segment } from '@/lib/types'

const ALL_SEGMENTS: Segment[] = ['Regular', 'Explorer', 'Flickerer', 'Ghost', 'Hoarder', 'GroupBuyer', 'Dormant']
const SEGMENT_EMOJI: Record<Segment, string> = {
  Regular: '⭐', Explorer: '🧭', Flickerer: '🎯',
  Ghost: '👻', Hoarder: '💰', GroupBuyer: '👥', Dormant: '💤',
}

interface SearchParams { q?: string; segment?: string; temp?: string; time?: string }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, segment, temp, time } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('crm_id, first_name, last_name, email, mobile, segment, rfm_r, rfm_f, rfm_m')
    .eq('is_active', 1)
    .order('last_updated', { ascending: false })
    .limit(200)

  if (segment) query = query.eq('segment', segment)
  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,mobile.ilike.%${q}%`,
    )
  }

  const { data: customers } = await query

  let drinkQuery = supabase
    .from('drink_profiles')
    .select('customer_id, preferred_temp, preferred_time_slot, preferred_milk, favourite_drink')
  if (temp) drinkQuery = drinkQuery.eq('preferred_temp', temp)
  if (time) drinkQuery = drinkQuery.eq('preferred_time_slot', time)
  const { data: drinkProfiles } = await drinkQuery

  const drinkByCustomer = new Map((drinkProfiles ?? []).map(d => [d.customer_id, d]))

  const filteredCustomers = (temp || time)
    ? (customers ?? []).filter(c => drinkByCustomer.has(c.crm_id))
    : (customers ?? [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Customers</h1>
          <p className="text-stone-400 text-sm mt-0.5">{filteredCustomers.length} shown</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[240px]">
          <Suspense>
            <SearchBar defaultValue={q ?? ''} />
          </Suspense>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a
            href="/dashboard/customers"
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!segment ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-stone-700 text-stone-400 hover:border-stone-600'}`}
          >
            All
          </a>
          {ALL_SEGMENTS.map(seg => (
            <a
              key={seg}
              href={`/dashboard/customers?segment=${seg}${q ? `&q=${q}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${segment === seg ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-stone-700 text-stone-400 hover:border-stone-600'}`}
            >
              {SEGMENT_EMOJI[seg]} {seg}
            </a>
          ))}
        </div>
      </div>

      {filteredCustomers.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {filteredCustomers.map(c => {
            const drink = drinkByCustomer.get(c.crm_id)
            return (
              <CustomerCard
                key={c.crm_id}
                {...c}
                preferred_temp={drink?.preferred_temp}
                preferred_time_slot={drink?.preferred_time_slot}
                preferred_milk={drink?.preferred_milk}
                favourite_drink={drink?.favourite_drink}
              />
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-stone-500">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-semibold text-white">No customers found</p>
          <p className="text-sm mt-1">Try a different search or filter.</p>
        </div>
      )}
    </div>
  )
}
