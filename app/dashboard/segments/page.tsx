export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SegmentTable } from '@/components/segments/SegmentTable'
import type { Segment } from '@/lib/types'

const ALL_SEGMENTS: Segment[] = ['Regular', 'Explorer', 'Flickerer', 'Ghost', 'Hoarder', 'GroupBuyer', 'Dormant']

const SEGMENT_META: Record<Segment, {
  emoji: string
  color: string
  chipActive: string
  headline: string
  detail: string
  action: string
}> = {
  Regular: {
    emoji: '⭐', color: 'text-green-400',
    chipActive: 'bg-green-500/20 border-green-500/50 text-green-300',
    headline: 'Consistent, loyal visitors',
    detail: '3+ visits in the last 60 days with gaps of ≤30 days between visits. Your core revenue base.',
    action: 'Reward with loyalty perks, early access, or personalised thank-you messages.',
  },
  Explorer: {
    emoji: '🧭', color: 'text-blue-400',
    chipActive: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    headline: 'Multi-outlet adventurers',
    detail: '3+ outlets visited across at least 3 total transactions. They love discovering new locations.',
    action: 'Invite to newly opened outlets, send outlet-specific promotions.',
  },
  Flickerer: {
    emoji: '🎯', color: 'text-orange-400',
    chipActive: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    headline: 'Early signs of churn',
    detail: '2–4 total visits but their last visit is already longer than 1.5× their usual gap (and >45 days). Drifting away.',
    action: 'Send a re-engagement offer before they go fully dormant.',
  },
  Ghost: {
    emoji: '👻', color: 'text-red-400',
    chipActive: 'bg-red-500/20 border-red-500/50 text-red-300',
    headline: 'One-time visitors',
    detail: 'Visited exactly once and never came back, or lapsed very early with fewer than 2 visits.',
    action: 'Win-back campaign — remind them what they ordered, offer a first-return incentive.',
  },
  Hoarder: {
    emoji: '💰', color: 'text-purple-400',
    chipActive: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    headline: 'Points collectors, not redeemers',
    detail: '3+ visits, over 100 points accumulated, but zero voucher redemptions. Sitting on value.',
    action: 'Nudge to redeem — highlight expiry, show what their points can get them.',
  },
  GroupBuyer: {
    emoji: '👥', color: 'text-yellow-400',
    chipActive: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    headline: 'Orders for a crowd',
    detail: 'Has placed at least one bill with 5+ items and maintains an average item quantity of 3+.',
    action: 'Target group deals, bundle promotions, and office/team catering offers.',
  },
  Dormant: {
    emoji: '💤', color: 'text-stone-400',
    chipActive: 'bg-stone-600/30 border-stone-500/50 text-stone-300',
    headline: 'Lost customers — 90+ day gap',
    detail: 'No visits in over 90 days with very few historical transactions. At high churn risk.',
    action: 'Last-chance reactivation — bold offer or personal outreach before writing off.',
  },
}

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>
}) {
  const { segment: rawSegment } = await searchParams
  const activeSegment: Segment = (ALL_SEGMENTS.includes(rawSegment as Segment) ? rawSegment : 'Dormant') as Segment

  const supabase = await createClient()

  // Segment counts — one count query per segment, no row cap
  const segCountResults = await Promise.all(
    ALL_SEGMENTS.map(seg =>
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('segment', seg).eq('is_active', 1)
    )
  )
  const segCounts = Object.fromEntries(
    ALL_SEGMENTS.map((seg, i) => [seg, segCountResults[i].count ?? 0])
  ) as Record<Segment, number>

  // Customers for active segment (display — capped at 1000)
  const { data: customers } = await supabase
    .from('customers')
    .select('crm_id, first_name, last_name, mobile, segment, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item')
    .eq('segment', activeSegment)
    .eq('is_active', 1)
    .order('last_visit_date', { ascending: false, nullsFirst: false })
    .limit(1000)

  const meta = SEGMENT_META[activeSegment]
  const totalForSegment = segCounts[activeSegment]

  return (
    <div className="p-8 max-w-7xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Segments</h1>
        <p className="text-stone-400 text-sm mt-0.5">
          Browse customers by behaviour segment · filter · export to CSV
        </p>
      </div>

      {/* ── Segment filter chips ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_SEGMENTS.map(seg => {
          const m = SEGMENT_META[seg]
          const isActive = seg === activeSegment
          return (
            <Link
              key={seg}
              href={`/dashboard/segments?segment=${seg}`}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? m.chipActive
                  : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
              }`}
            >
              <span className={`text-base leading-none ${m.color}`}>{m.emoji}</span>
              {seg}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/10' : 'bg-stone-800'
              }`}>
                {segCounts[seg].toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>

      {/* ── Active segment explainer ───────────────────────────────────────── */}
      <div className={`border rounded-2xl p-5 mb-6 ${
        activeSegment === 'Regular' ? 'bg-green-500/5 border-green-500/20' :
        activeSegment === 'Explorer' ? 'bg-blue-500/5 border-blue-500/20' :
        activeSegment === 'Flickerer' ? 'bg-orange-500/5 border-orange-500/20' :
        activeSegment === 'Ghost' ? 'bg-red-500/5 border-red-500/20' :
        activeSegment === 'Hoarder' ? 'bg-purple-500/5 border-purple-500/20' :
        activeSegment === 'GroupBuyer' ? 'bg-yellow-500/5 border-yellow-500/20' :
        'bg-stone-800/30 border-stone-700/50'
      }`}>
        <div className="flex items-start gap-4">
          <span className="text-3xl leading-none mt-0.5">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className={`text-base font-bold ${meta.color}`}>{activeSegment}</h2>
              <span className="text-stone-400 text-sm">— {meta.headline}</span>
            </div>
            <p className="text-stone-400 text-sm mt-1.5 leading-relaxed">{meta.detail}</p>
            <div className="flex items-start gap-2 mt-2.5">
              <span className="text-xs font-semibold text-stone-500 uppercase mt-0.5 flex-shrink-0">Suggested action</span>
              <p className="text-stone-300 text-sm">{meta.action}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RFM guide ─────────────────────────────────────────────────────── */}
      <details className="group mb-6">
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
          <p className="text-stone-400 text-sm mb-4">
            Each customer has an RFM score displayed as <span className="text-amber-400 font-semibold font-mono">R-F-M</span>.
            Scores range from <span className="text-stone-300 font-semibold">1 (lowest)</span> to <span className="text-stone-300 font-semibold">5 (highest)</span>, calculated as quintiles across all customers.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                letter: 'R', name: 'Recency', color: 'text-green-400 bg-green-500/10 border-green-500/25',
                desc: 'Days since last visit. Score 5 = visited very recently. Score 1 = hasn\'t visited in a long time.',
              },
              {
                letter: 'F', name: 'Frequency', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
                desc: 'Visits in the last 90 days. Score 5 = most frequent visitors. Score 1 = rarely visits.',
              },
              {
                letter: 'M', name: 'Monetary', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
                desc: 'Average spend per visit. Score 5 = highest spenders. Score 1 = lowest average ticket.',
              },
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
          <p className="text-stone-500 text-xs mt-3">
            <span className="text-amber-400 font-mono font-semibold">5-5-5</span> = best possible customer (recent, frequent, high spender) ·{' '}
            <span className="text-stone-400 font-mono font-semibold">1-1-1</span> = needs most attention
          </p>
        </div>
      </details>

      {/* ── Customer table ─────────────────────────────────────────────────── */}
      <SegmentTable
        customers={customers ?? []}
        total={totalForSegment}
        segment={activeSegment}
      />
    </div>
  )
}
