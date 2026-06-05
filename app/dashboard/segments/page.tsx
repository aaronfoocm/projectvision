export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SegmentTable } from '@/components/segments/SegmentTable'
import { FilterPanel } from '@/components/segments/FilterPanel'
import { ALL_SEGMENTS } from '@/lib/segment-meta'
import type { Segment } from '@/lib/types'

const PAGE_SIZE = 1000

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    segment?: string; r?: string; f?: string; m?: string
    time?: string; page?: string; outlet?: string; loc?: string; drink?: string
  }>
}) {
  const sp = await searchParams
  const activeSegment  = ALL_SEGMENTS.includes(sp.segment as Segment) ? (sp.segment as Segment) : null
  const parseList      = (v?: string) => (v ?? '').split(',').filter(Boolean)
  const outletFilter   = parseList(sp.outlet)
  const locFilter      = parseList(sp.loc)
  const drinkFilter    = parseList(sp.drink)

  const parseScores    = (v?: string) => (v ?? '').split(',').filter(Boolean).map(Number).filter(n => n >= 1 && n <= 5)
  const rfmR           = parseScores(sp.r)
  const rfmF           = parseScores(sp.f)
  const rfmM           = parseScores(sp.m)
  const timeFilter     = sp.time ?? ''
  const page           = Math.max(1, parseInt(sp.page ?? '1') || 1)
  const hasRfmFilter   = rfmR.length > 0 || rfmF.length > 0 || rfmM.length > 0
  const hasAnyFilter   = !!activeSegment || hasRfmFilter || !!timeFilter || !!outletFilter.length || !!locFilter.length || !!drinkFilter.length

  function buildHref(overrides: Record<string, string | null>) {
    const p = new URLSearchParams()
    const vals: Record<string, string | null> = {
      segment: activeSegment,
      r: rfmR.length ? rfmR.join(',') : null,
      f: rfmF.length ? rfmF.join(',') : null,
      m: rfmM.length ? rfmM.join(',') : null,
      time: timeFilter || null,
      outlet: outletFilter.length ? outletFilter.join(',') : null,
      loc: locFilter.length ? locFilter.join(',') : null,
      drink: drinkFilter.length ? drinkFilter.join(',') : null,
      page: page > 1 ? String(page) : null,
      ...overrides,
    }
    for (const [k, v] of Object.entries(vals)) if (v) p.set(k, v)
    return `/dashboard/segments?${p.toString()}`
  }

  const supabase = await createClient()

  // ── Fetch filter option lists ──────────────────────────────────────────────
  // Paginate to get all distinct outlets and current locations
  const allOutletRows: string[] = []
  const allLocRows: string[] = []
  let from = 0
  while (true) {
    const { data } = await supabase.from('customers')
      .select('favourite_outlet, current_loc_code')
      .not('favourite_outlet', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (r.favourite_outlet) allOutletRows.push(r.favourite_outlet)
      if (r.current_loc_code) allLocRows.push(r.current_loc_code)
    }
    if (data.length < 1000) break
    from += 1000
  }
  const distinctOutlets = [...new Set(allOutletRows)].sort()
  const distinctLocs    = [...new Set(allLocRows)].sort()

  // Distinct favourite drinks (paginated)
  const allDrinkRows: string[] = []
  from = 0
  while (true) {
    const { data } = await supabase.from('drink_profiles')
      .select('favourite_drink').not('favourite_drink', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data) if (r.favourite_drink) allDrinkRows.push(r.favourite_drink)
    if (data.length < 1000) break
    from += 1000
  }
  const distinctDrinks = [...new Set(allDrinkRows)].sort()

  // ── Segment chip counts ────────────────────────────────────────────────────
  const segCountResults = await Promise.all(
    ALL_SEGMENTS.map(seg => {
      let q = supabase.from('customers')
        .select(timeFilter || drinkFilter.length ? '*, drink_profiles!inner(preferred_time_slot, favourite_drink)' : '*',
          { count: 'exact', head: true })
        .eq('segment', seg).eq('is_active', 1)
      if (outletFilter.length) q = q.in('favourite_outlet', outletFilter)
      if (locFilter.length)    q = q.in('current_loc_code', locFilter)
      if (timeFilter)          q = (q as any).eq('drink_profiles.preferred_time_slot', timeFilter)
      if (drinkFilter.length)  q = (q as any).in('drink_profiles.favourite_drink', drinkFilter)
      return q
    })
  )
  const segCounts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segCountResults[i].count ?? 0])
  ) as Record<Segment, number>

  // ── Main query ─────────────────────────────────────────────────────────────
  const needsDrinkJoin = !!(timeFilter || drinkFilter.length)
  const selectStr = needsDrinkJoin
    ? 'crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item, drink_profiles!inner(preferred_time_slot, favourite_drink)'
    : 'crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item'

  let countQ = supabase.from('customers')
    .select(needsDrinkJoin ? '*, drink_profiles!inner(preferred_time_slot, favourite_drink)' : '*',
      { count: 'exact', head: true })
    .eq('is_active', 1)
  if (activeSegment)       countQ = countQ.eq('segment', activeSegment)
  if (rfmR.length)         countQ = countQ.in('rfm_r', rfmR)
  if (rfmF.length)         countQ = countQ.in('rfm_f', rfmF)
  if (rfmM.length)         countQ = countQ.in('rfm_m', rfmM)
  if (outletFilter.length) countQ = countQ.in('favourite_outlet', outletFilter)
  if (locFilter.length)    countQ = countQ.in('current_loc_code', locFilter)
  if (timeFilter)          countQ = (countQ as any).eq('drink_profiles.preferred_time_slot', timeFilter)
  if (drinkFilter.length)  countQ = (countQ as any).in('drink_profiles.favourite_drink', drinkFilter)

  let custQ = supabase.from('customers')
    .select(selectStr)
    .eq('is_active', 1)
    .order('last_visit_date', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (activeSegment)       custQ = custQ.eq('segment', activeSegment)
  if (rfmR.length)         custQ = custQ.in('rfm_r', rfmR)
  if (rfmF.length)         custQ = custQ.in('rfm_f', rfmF)
  if (rfmM.length)         custQ = custQ.in('rfm_m', rfmM)
  if (outletFilter.length) custQ = custQ.in('favourite_outlet', outletFilter)
  if (locFilter.length)    custQ = custQ.in('current_loc_code', locFilter)
  if (timeFilter)          custQ = (custQ as any).eq('drink_profiles.preferred_time_slot', timeFilter)
  if (drinkFilter.length)  custQ = (custQ as any).in('drink_profiles.favourite_drink', drinkFilter)

  const [{ count: totalCount }, { data: customers }] = await Promise.all([countQ, custQ])

  const total      = totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cleanCustomers = (customers ?? []).map(({ drink_profiles: dp, ...c }: any) => ({
    ...c,
    favourite_drink: (dp as any)?.favourite_drink ?? null,
  }))

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Segments</h1>
          <p className="text-stone-500 text-sm mt-0.5">Browse and filter customers · export to CSV.</p>
        </div>
        <Link href="/dashboard/guide"
          className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer"
        >
          <BookOpen size={13} /> Segment guide
        </Link>
      </div>

      <FilterPanel
        segCounts={segCounts}
        distinctOutlets={distinctOutlets}
        distinctLocs={distinctLocs}
        distinctDrinks={distinctDrinks}
      />

      {/* Active filter summary */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-stone-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          {activeSegment && <span className="text-stone-300">{activeSegment}</span>}
          {rfmR.length > 0 && <span>R={rfmR.join(',')}</span>}
          {rfmF.length > 0 && <span>F={rfmF.join(',')}</span>}
          {rfmM.length > 0 && <span>M={rfmM.join(',')}</span>}
          {timeFilter && <span className="text-sky-400">{timeFilter.charAt(0)+timeFilter.slice(1).toLowerCase()}</span>}
          {outletFilter.length > 0 && <span className="text-violet-400">{outletFilter.join(', ')}</span>}
          {locFilter.length > 0 && <span className="text-emerald-400">Loc: {locFilter.join(', ')}</span>}
          {drinkFilter.length > 0 && <span className="text-amber-400 truncate max-w-[240px]">{drinkFilter.join(', ')}</span>}
          <span className="text-stone-600">·</span>
          <span className="text-stone-300 font-semibold tabular-nums">{total.toLocaleString()} customers</span>
        </div>
      )}

      <SegmentTable
        customers={cleanCustomers}
        total={total}
        segment={activeSegment ?? 'All'}
        rfmR={rfmR} rfmF={rfmF} rfmM={rfmM}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-stone-500 tabular-nums">
            Page {page} of {totalPages.toLocaleString()} · {total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-white bg-stone-900 border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
              >
                <ChevronLeft size={13} /> Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })}
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
