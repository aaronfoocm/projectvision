export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SegmentTable } from '@/components/segments/SegmentTable'
import { RfmFilterChips } from '@/components/segments/RfmFilterChips'
import { TimeFilterChips } from '@/components/segments/TimeFilterChips'
import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Segment } from '@/lib/types'

const PAGE_SIZE = 1000

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; r?: string; f?: string; m?: string; time?: string; page?: string }>
}) {
  const sp = await searchParams
  const activeSegment = ALL_SEGMENTS.includes(sp.segment as Segment) ? (sp.segment as Segment) : null

  const parseScores = (v?: string) => (v ?? '').split(',').filter(Boolean).map(Number).filter(n => n >= 1 && n <= 5)
  const rfmR = parseScores(sp.r)
  const rfmF = parseScores(sp.f)
  const rfmM = parseScores(sp.m)
  const timeFilter   = sp.time ?? ''
  const page         = Math.max(1, parseInt(sp.page ?? '1') || 1)
  const hasRfmFilter = rfmR.length > 0 || rfmF.length > 0 || rfmM.length > 0
  const hasTimeFilter = !!timeFilter
  const hasAnyFilter  = !!activeSegment || hasRfmFilter || hasTimeFilter

  function buildHref(overrides: Record<string, string | null>) {
    const p = new URLSearchParams()
    const vals: Record<string, string | null> = {
      segment: activeSegment,
      r: rfmR.length ? rfmR.join(',') : null,
      f: rfmF.length ? rfmF.join(',') : null,
      m: rfmM.length ? rfmM.join(',') : null,
      time: timeFilter || null,
      page: page > 1 ? String(page) : null,
      ...overrides,
    }
    for (const [k, v] of Object.entries(vals)) if (v) p.set(k, v)
    return `/dashboard/segments?${p.toString()}`
  }

  const supabase = await createClient()

  // ── Segment chip counts ────────────────────────────────────────────────────
  const segCountResults = await Promise.all(
    ALL_SEGMENTS.map(seg => {
      let q = supabase.from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('segment', seg).eq('is_active', 1)
      if (timeFilter) {
        q = (q as any).select('*, drink_profiles!inner(preferred_time_slot)', { count: 'exact', head: true })
          .eq('drink_profiles.preferred_time_slot', timeFilter)
      }
      return q
    })
  )
  const segCounts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segCountResults[i].count ?? 0])
  ) as Record<Segment, number>

  // ── Filtered total count ───────────────────────────────────────────────────
  const selectStr = timeFilter
    ? 'crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item, drink_profiles!inner(preferred_time_slot)'
    : 'crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item'

  let countQ = supabase.from('customers')
    .select(timeFilter ? '*, drink_profiles!inner(preferred_time_slot)' : '*', { count: 'exact', head: true })
    .eq('is_active', 1)
  if (activeSegment) countQ = countQ.eq('segment', activeSegment)
  if (rfmR.length)   countQ = countQ.in('rfm_r', rfmR)
  if (rfmF.length)   countQ = countQ.in('rfm_f', rfmF)
  if (rfmM.length)   countQ = countQ.in('rfm_m', rfmM)
  if (timeFilter)    countQ = (countQ as any).eq('drink_profiles.preferred_time_slot', timeFilter)

  let custQ = supabase.from('customers')
    .select(selectStr)
    .eq('is_active', 1)
    .order('last_visit_date', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (activeSegment) custQ = custQ.eq('segment', activeSegment)
  if (rfmR.length)   custQ = custQ.in('rfm_r', rfmR)
  if (rfmF.length)   custQ = custQ.in('rfm_f', rfmF)
  if (rfmM.length)   custQ = custQ.in('rfm_m', rfmM)
  if (timeFilter)    custQ = (custQ as any).eq('drink_profiles.preferred_time_slot', timeFilter)

  const [{ count: totalCount }, { data: customers }] = await Promise.all([countQ, custQ])

  const total     = totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Strip the nested drink_profiles object from customer rows before passing down
  const cleanCustomers = (customers ?? []).map(({ drink_profiles: _dp, ...c }: any) => c)

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Segments</h1>
          <p className="text-stone-500 text-sm mt-0.5">Browse and filter customers · export to CSV.</p>
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
          <Link
            href={buildHref({ segment: null, page: null })}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer ${
              !activeSegment
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
            }`}
          >
            All
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${!activeSegment ? 'bg-white/10' : 'bg-stone-800 text-stone-500'}`}>
              {ALL_SEGMENTS.reduce((s, seg) => s + segCounts[seg], 0).toLocaleString()}
            </span>
          </Link>
          {ALL_SEGMENTS.map(seg => {
            const m = SEGMENT_META[seg]
            const isActive = seg === activeSegment
            return (
              <Link
                key={seg}
                href={buildHref({ segment: seg, page: null })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? m.chipActive
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
                }`}
              >
                <span className={`text-base leading-none ${m.color}`}>{m.emoji}</span>
                {seg}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${isActive ? 'bg-white/10' : 'bg-stone-800 text-stone-500'}`}>
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
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-stone-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          {activeSegment && <span className="text-stone-300">{activeSegment}</span>}
          {rfmR.length > 0 && <span>R = {rfmR.join(', ')}</span>}
          {rfmF.length > 0 && <span>F = {rfmF.join(', ')}</span>}
          {rfmM.length > 0 && <span>M = {rfmM.join(', ')}</span>}
          {hasTimeFilter && <span className="text-sky-400">{timeFilter.charAt(0) + timeFilter.slice(1).toLowerCase()}</span>}
          <span className="text-stone-600">·</span>
          <span className="text-stone-300 font-semibold tabular-nums">{total.toLocaleString()} customers</span>
        </div>
      )}

      {/* Table */}
      <SegmentTable
        customers={cleanCustomers}
        total={total}
        segment={activeSegment ?? 'All'}
        rfmR={rfmR}
        rfmF={rfmF}
        rfmM={rfmM}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-stone-500 tabular-nums">
            Page {page} of {totalPages.toLocaleString()} · {total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-white bg-stone-900 border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
              >
                <ChevronLeft size={13} /> Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-white bg-stone-900 border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
              >
                Next <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
