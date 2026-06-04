export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { SegmentTable } from '@/components/segments/SegmentTable'
import { RfmFilterChips } from '@/components/segments/RfmFilterChips'
import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'
import type { Segment } from '@/lib/types'
import { Skeleton } from '@/components/ui/Skeleton'

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; r?: string; f?: string; m?: string }>
}) {
  const sp = await searchParams
  const activeSegment: Segment = (ALL_SEGMENTS.includes(sp.segment as Segment) ? sp.segment : 'Dormant') as Segment

  const parseScores = (v?: string) => (v ?? '').split(',').filter(Boolean).map(Number).filter(n => n >= 1 && n <= 5)
  const rfmR = parseScores(sp.r)
  const rfmF = parseScores(sp.f)
  const rfmM = parseScores(sp.m)
  const hasRfmFilter = rfmR.length > 0 || rfmF.length > 0 || rfmM.length > 0

  function segmentHref(seg: string) {
    const p = new URLSearchParams({ segment: seg })
    if (rfmR.length) p.set('r', rfmR.join(','))
    if (rfmF.length) p.set('f', rfmF.join(','))
    if (rfmM.length) p.set('m', rfmM.join(','))
    return `/dashboard/segments?${p.toString()}`
  }

  const supabase = await createClient()

  const segCountResults = await Promise.all(
    ALL_SEGMENTS.map(seg =>
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', seg).eq('is_active', 1)
    )
  )
  const segCounts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segCountResults[i].count ?? 0])
  ) as Record<Segment, number>

  let countQ = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', activeSegment).eq('is_active', 1)
  if (rfmR.length) countQ = countQ.in('rfm_r', rfmR)
  if (rfmF.length) countQ = countQ.in('rfm_f', rfmF)
  if (rfmM.length) countQ = countQ.in('rfm_m', rfmM)

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

  const [{ count: filteredCount }, { data: customers }] = await Promise.all([countQ, custQ])

  const meta = SEGMENT_META[activeSegment]
  const totalForSegment = filteredCount ?? 0

  return (
    <div className="p-8 max-w-7xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Segments</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Browse customers by behaviour segment, filter by RFM, and export to CSV.
        </p>
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
      <div className="mt-4 mb-6">
        <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">RFM Filter</p>
        <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
          <RfmFilterChips />
        </Suspense>
      </div>

      {/* Active segment explainer */}
      <div className={`border rounded-xl p-5 mb-5 ${
        activeSegment === 'Regular'    ? 'bg-green-500/5 border-green-500/20' :
        activeSegment === 'Explorer'   ? 'bg-blue-500/5 border-blue-500/20' :
        activeSegment === 'Flickerer'  ? 'bg-orange-500/5 border-orange-500/20' :
        activeSegment === 'Ghost'      ? 'bg-red-500/5 border-red-500/20' :
        activeSegment === 'Hoarder'    ? 'bg-purple-500/5 border-purple-500/20' :
        activeSegment === 'GroupBuyer' ? 'bg-yellow-500/5 border-yellow-500/20' :
        'bg-stone-800/30 border-stone-700/50'
      }`}>
        <div className="flex items-start gap-4">
          <span className="text-2xl leading-none mt-0.5">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className={`text-sm font-bold ${meta.color}`}>{activeSegment}</h2>
              <span className="text-stone-400 text-sm">{meta.headline}</span>
            </div>
            <p className="text-stone-500 text-sm mt-1.5 leading-relaxed">{meta.detail}</p>
            <div className="flex items-start gap-2 mt-2.5">
              <span className="text-xs font-semibold text-stone-600 uppercase mt-0.5 flex-shrink-0">Action</span>
              <p className="text-stone-300 text-sm">{meta.action}</p>
            </div>
          </div>
        </div>
      </div>

      {/* RFM legend */}
      <details className="group mb-5">
        <summary className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 cursor-pointer transition-colors duration-150 select-none list-none w-fit">
          <span className="w-4 h-4 border border-stone-700 rounded flex items-center justify-center text-stone-600 group-open:text-stone-400 transition-colors">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 3l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="group-open:hidden" />
              <path d="M1 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="hidden group-open:block" />
            </svg>
          </span>
          Understanding RFM scores
        </summary>
        <div className="mt-3 bg-stone-900 border border-stone-800 rounded-xl p-5">
          <p className="text-stone-500 text-sm mb-4">
            Each customer has an RFM score displayed as{' '}
            <span className="text-amber-400 font-semibold font-mono">R-F-M</span>.
            Scores range from <span className="text-stone-300 font-semibold">1 (lowest)</span> to{' '}
            <span className="text-stone-300 font-semibold">5 (highest)</span>, calculated as quintiles across all customers.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { letter: 'R', name: 'Recency', color: 'text-green-400 bg-green-500/10 border-green-500/25',
                desc: "Days since last visit. Score 5 = visited very recently. Score 1 = hasn't visited in a long time." },
              { letter: 'F', name: 'Frequency', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
                desc: 'Visits in the last 90 days. Score 5 = most frequent visitors. Score 1 = rarely visits.' },
              { letter: 'M', name: 'Monetary', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
                desc: 'Average spend per visit. Score 5 = highest spenders. Score 1 = lowest average ticket.' },
            ].map(({ letter, name, color, desc }) => (
              <div key={letter} className={`rounded-xl border p-4 ${color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl font-black font-mono">{letter}</span>
                  <span className="text-sm font-semibold">{name}</span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-600 text-xs mt-3">
            <span className="text-amber-400 font-mono font-semibold">5-5-5</span> = best possible customer (recent, frequent, high spender){' '}
            <span className="text-stone-700 mx-1">·</span>
            <span className="text-stone-500 font-mono font-semibold">1-1-1</span> = needs most attention
          </p>
        </div>
      </details>

      {/* Active filter summary */}
      {hasRfmFilter && (
        <div className="flex items-center gap-2 mb-3 text-xs text-stone-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          RFM filter active
          {rfmR.length > 0 && <span className="text-stone-400">R = {rfmR.join(', ')}</span>}
          {rfmF.length > 0 && <span className="text-stone-400">F = {rfmF.join(', ')}</span>}
          {rfmM.length > 0 && <span className="text-stone-400">M = {rfmM.join(', ')}</span>}
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
