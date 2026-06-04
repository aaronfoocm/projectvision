export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { SegmentCard } from '@/components/dashboard/SegmentCard'
import { FilterChips } from '@/components/dashboard/FilterChips'
import { TrendChart } from '@/components/dashboard/TrendChart'
import type { Segment } from '@/lib/types'

const ALL_SEGMENTS: Segment[] = ['Regular', 'Explorer', 'Flickerer', 'Ghost', 'Hoarder', 'GroupBuyer', 'Dormant']

interface SearchParams { temp?: string; time?: string; milk?: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const filters = await searchParams
  const supabase = await createClient()

  const hasFilter = filters.temp || filters.time || filters.milk
  let filteredIds: string[] | null = null

  if (hasFilter) {
    let q = supabase.from('drink_profiles').select('customer_id')
    if (filters.temp) q = q.eq('preferred_temp', filters.temp)
    if (filters.time) q = q.eq('preferred_time_slot', filters.time)
    if (filters.milk) q = q.ilike('preferred_milk', `%${filters.milk}%`)
    const { data } = await q
    filteredIds = (data ?? []).map(r => r.customer_id)
  }

  let customersQuery = supabase
    .from('customers')
    .select('crm_id, segment, rfm_r, rfm_f, rfm_m, first_name, last_name')
    .eq('is_active', 1)
    .not('segment', 'is', null)
  if (filteredIds !== null) customersQuery = customersQuery.in('crm_id', filteredIds)

  // Segment counts: one count-per-segment query to bypass the 1000-row cap
  const segCountQueries = ALL_SEGMENTS.map(seg => {
    let q = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', seg).eq('is_active', 1)
    if (filteredIds !== null) q = q.in('crm_id', filteredIds)
    return q
  })

  const [{ data: customers }, ...segResults] = await Promise.all([customersQuery, ...segCountQueries])

  const counts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segResults[i].count ?? 0])
  ) as Record<Segment, number>

  const { data: drinkProfiles } = await supabase
    .from('drink_profiles')
    .select('customer_id, preferred_temp, preferred_time_slot')
  const drinkByCustomer = new Map((drinkProfiles ?? []).map(d => [d.customer_id, d]))

  const top5 = [...(customers ?? [])]
    .filter(c => c.rfm_r && c.rfm_f && c.rfm_m)
    .sort((a, b) => (b.rfm_r + b.rfm_f + b.rfm_m) - (a.rfm_r + a.rfm_f + a.rfm_m))
    .slice(0, 5)

  const { count: pendingCount } = await supabase
    .from('journey_log')
    .select('*', { count: 'exact', head: true })
    .eq('completed', 0)

  const trendDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (4 - i))
    return d.toISOString().slice(0, 10)
  })
  const trend = trendDates.map(date => ({
    date: date.slice(5),
    Regular: counts.Regular,
    Flickerer: counts.Flickerer,
    Ghost: counts.Ghost,
    Dormant: counts.Dormant,
  }))

  const today = new Date().toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Good morning ☕</h1>
          <p className="text-stone-400 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {(pendingCount ?? 0) > 0 && (
            <a
              href="/dashboard/actions"
              className="bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-500/25 transition-colors"
            >
              ⚡ {pendingCount} action{pendingCount !== 1 ? 's' : ''} today
            </a>
          )}
          <a
            href="/dashboard/upload"
            className="bg-stone-800 border border-stone-700 text-stone-300 text-sm px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors"
          >
            ☁️ Upload CSVs
          </a>
        </div>
      </div>

      <Suspense>
        <FilterChips />
      </Suspense>

      <div className="grid grid-cols-7 gap-3 mb-8">
        {ALL_SEGMENTS.map(seg => (
          <SegmentCard
            key={seg}
            segment={seg}
            count={counts[seg]}
            href={`/dashboard/customers?segment=${seg}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-semibold mb-4">
            Segment trend — last 5 days
          </p>
          <TrendChart data={trend} />
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-semibold mb-4">
            Top 5 by RFM score
          </p>
          <div className="space-y-3">
            {top5.length === 0 && (
              <p className="text-stone-500 text-sm">No data yet — upload CSVs first.</p>
            )}
            {top5.map(c => {
              const drink = drinkByCustomer.get(c.crm_id)
              const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.crm_id
              return (
                <a key={c.crm_id} href={`/dashboard/customers/${c.crm_id}`} className="flex items-center justify-between hover:opacity-80 transition-opacity">
                  <div>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs text-stone-500">
                      {drink?.preferred_temp} · {drink?.preferred_time_slot}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-400">
                    {c.rfm_r}-{c.rfm_f}-{c.rfm_m}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
