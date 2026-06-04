export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SegmentTable } from '@/components/segments/SegmentTable'
import { RfmFilterChips } from '@/components/segments/RfmFilterChips'
import { TimeFilterChips } from '@/components/segments/TimeFilterChips'
import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Segment } from '@/lib/types'

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; r?: string; f?: string; m?: string; time?: string }>
}) {
  const sp = await searchParams
  const activeSegment: Segment = (ALL_SEGMENTS.includes(sp.segment as Segment) ? sp.segment : 'Dormant') as Segment

  const parseScores = (v?: string) => (v ?? '').split(',').filter(Boolean).map(Number).filter(n => n >= 1 && n <= 5)
  const rfmR = parseScores(sp.r)
  const rfmF = parseScores(sp.f)
  const rfmM = parseScores(sp.m)
  const timeFilter = sp.time ?? ''
  const hasRfmFilter  = rfmR.length > 0 || rfmF.length > 0 || rfmM.length > 0
  const hasTimeFilter = !!timeFilter

  function segmentHref(seg: string) {
    const p = new URLSearchParams({ segment: seg })
    if (rfmR.length)  p.set('r', rfmR.join(','))
    if (rfmF.length)  p.set('f', rfmF.join(','))
    if (rfmM.length)  p.set('m', rfmM.join(','))
    if (timeFilter)   p.set('time', timeFilter)
    return `/dashboard/segments?${p.toString()}`
  }

  const supabase = await createClient()

  // If time filter active, paginate drink_profiles to avoid the 1000-row PostgREST cap
  let timeFilteredIds: string[] | null = null
  if (timeFilter) {
    const ids: string[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('drink_profiles')
        .select('customer_id')
        .eq('preferred_time_slot', timeFilter)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      ids.push(...data.map(r => r.customer_id))
      if (data.length < PAGE) break
      from += PAGE
    }
    timeFilteredIds = ids
  }

  // Segment counts
  const segCountResults = await Promise.all(
    ALL_SEGMENTS.map(seg => {
      let q = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', seg).eq('is_active', 1)
      if (timeFilteredIds !== null) q = q.in('crm_id', timeFilteredIds)
      return q
    })
  )
  const segCounts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segCountResults[i].count ?? 0])
  ) as Record<Segment, number>

  // Filtered count and rows
  let countQ = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', activeSegment).eq('is_active', 1)
  if (rfmR.length) countQ = countQ.in('rfm_r', rfmR)
  if (rfmF.length) countQ = countQ.in('rfm_f', rfmF)
  if (rfmM.length) countQ = countQ.in('rfm_m', rfmM)
  if (timeFilteredIds !== null) countQ = countQ.in('crm_id', timeFilteredIds)

  let custQ = supabase
    .from('customers')
    .select('crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item')
    .eq('segment', activeSegment)
    .eq('is_active', 1)
    .order('last_visit_date', { ascending: false, nullsFirst: false })
    .limit(1000)
  if (rfmR.length) custQ = custQ.in('rfm_r', rfmR)
  if (rfmF.length) custQ = custQ.in('rfm_f', rfmF)
  if (rfmM.length) custQ = custQ.in('rfm_m', rfmM)
  if (timeFilteredIds !== null) custQ = custQ.in('crm_id', timeFilteredIds)

  const [{ count: filteredCount }, { data: customers }] = await Promise.all([countQ, custQ])

  const meta = SEGMENT_META[activeSegment]
  const totalForSegment = filteredCount ?? 0

  return (
    <div className="p-8 max-w-7xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Segments</h1>
          <p className="text-stone-500 text-sm mt-0.5">Browse customers by behaviour segment, filter, and export to CSV.</p>
        </div>
        <Link
          href="/dashboard/guide"
          className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer"
        >
          <BookOpen size={13} />
          Segment guide
        </Link>
      </div>

      {/* Segment chips */}
      <div className="mb-2">
        <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">Segment</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SEGMENTS.map(seg => {
            const m = SEGMENT_META[seg]
            const isActive = seg === activeSegment
            return (
              <Link
                key={seg}
                href={segmentHref(seg)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? m.chipActive
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
                }`}
              >
                <span className={`text-base leading-none ${m.color}`}>{m.emoji}</span>
                {seg}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                  isActive ? 'bg-white/10' : 'bg-stone-800 text-stone-500'
                }`}>
                  {segCounts[seg].toLocaleString()}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* RFM filter */}
      <div className="mt-4">
        <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">RFM Filter</p>
        <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
          <RfmFilterChips />
        </Suspense>
      </div>

      {/* Time of day filter */}
      <div className="mt-3 mb-6">
        <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">Time of Day</p>
        <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}>
          <TimeFilterChips />
        </Suspense>
      </div>

      {/* Active filter summary */}
      {(hasRfmFilter || hasTimeFilter) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-stone-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          {hasRfmFilter && <>
            {rfmR.length > 0 && <span className="text-stone-400">R = {rfmR.join(', ')}</span>}
            {rfmF.length > 0 && <span className="text-stone-400">F = {rfmF.join(', ')}</span>}
            {rfmM.length > 0 && <span className="text-stone-400">M = {rfmM.join(', ')}</span>}
          </>}
          {hasTimeFilter && <span className="text-sky-400">Time = {timeFilter.charAt(0) + timeFilter.slice(1).toLowerCase()}</span>}
          <span className="text-stone-600">·</span>
          <span className="text-stone-300 font-semibold tabular-nums">{totalForSegment.toLocaleString()} customers match</span>
        </div>
      )}

      <SegmentTable
        customers={customers ?? []}
        total={totalForSegment}
        segment={activeSegment}
        rfmR={rfmR}
        rfmF={rfmF}
        rfmM={rfmM}
      />
    </div>
  )
}
