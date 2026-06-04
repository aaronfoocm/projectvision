import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CustomerCard } from '@/components/customers/CustomerCard'
import { SearchBar } from '@/components/customers/SearchBar'
import { OutletSelect } from '@/components/customers/OutletSelect'
import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'
import type { Segment } from '@/lib/types'

const LIMIT = 200

interface SearchParams { q?: string; segment?: string; temp?: string; time?: string; outlet?: string }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, segment, temp, time, outlet } = await searchParams
  const supabase = await createClient()

  // Paginate to get all distinct outlet codes (single-column, 1000-row pages)
  const allOutletRows: string[] = []
  let outletFrom = 0
  while (true) {
    const { data } = await supabase.from('customers')
      .select('favourite_outlet').not('favourite_outlet', 'is', null)
      .range(outletFrom, outletFrom + 999)
    if (!data || data.length === 0) break
    for (const r of data) if (r.favourite_outlet) allOutletRows.push(r.favourite_outlet)
    if (data.length < 1000) break
    outletFrom += 1000
  }
  const outlets = [...new Set(allOutletRows)].sort()

  let query = supabase
    .from('customers')
    .select('crm_id, first_name, last_name, email, mobile, segment, rfm_r, rfm_f, rfm_m, favourite_outlet')
    .eq('is_active', 1)
    .order('last_updated', { ascending: false })
    .limit(LIMIT)

  if (segment) query = query.eq('segment', segment)
  if (outlet)  query = query.eq('favourite_outlet', outlet)
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

  const isAtLimit = filteredCustomers.length >= LIMIT
  const hasFilters = !!(q || segment || temp || time || outlet)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Customers</h1>
          <p className="text-stone-500 text-sm mt-0.5 tabular-nums">
            {filteredCustomers.length.toLocaleString()} shown
            {isAtLimit && (
              <span className="text-amber-500/70"> — showing first {LIMIT}. Use Segments to filter deeper.</span>
            )}
          </p>
        </div>
      </div>

      {/* Search + outlet filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[240px]">
          <Suspense>
            <SearchBar defaultValue={q ?? ''} />
          </Suspense>
        </div>
        <Suspense>
          <OutletSelect outlets={outlets} />
        </Suspense>
      </div>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <a
          href={`/dashboard/customers${outlet ? `?outlet=${outlet}` : ''}`}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
            !segment
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
              : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
          }`}
        >
          All
        </a>
        {ALL_SEGMENTS.map(seg => {
          const m = SEGMENT_META[seg as Segment]
          const isActive = segment === seg
          const href = `/dashboard/customers?segment=${seg}${q ? `&q=${encodeURIComponent(q)}` : ''}${outlet ? `&outlet=${outlet}` : ''}`
          return (
            <a
              key={seg}
              href={href}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                isActive
                  ? `${m.chipActive} font-semibold`
                  : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
              }`}
            >
              {m.emoji} {seg}
            </a>
          )
        })}
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
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-stone-500">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" />
            </svg>
          </div>
          <p className="text-stone-300 font-semibold text-sm">No customers found</p>
          <p className="text-stone-500 text-xs mt-1.5 max-w-xs leading-relaxed">
            {hasFilters
              ? 'Try clearing the search or selecting a different filter.'
              : 'Upload customer CSVs from the Upload page to populate this list.'}
          </p>
          {hasFilters && (
            <a
              href="/dashboard/customers"
              className="mt-4 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer"
            >
              Clear all filters
            </a>
          )}
        </div>
      )}
    </div>
  )
}
