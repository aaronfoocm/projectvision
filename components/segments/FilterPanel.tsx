'use client'
import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'
import { MultiSelectSearch } from '@/components/segments/MultiSelectSearch'
import type { Segment } from '@/lib/types'

const TIME_SLOTS = [
  { value: 'MORNING',   label: 'Morning',   desc: 'Before noon' },
  { value: 'AFTERNOON', label: 'Afternoon', desc: '12pm – 5pm' },
  { value: 'EVENING',   label: 'Evening',   desc: '5pm – 9pm' },
  { value: 'NIGHT',     label: 'Night',     desc: 'After 9pm' },
]

interface FilterState {
  segment: Segment | null
  rfmR: number[]
  rfmF: number[]
  rfmM: number[]
  time: string
  outlet: string[]
  loc: string[]
  drink: string[]
}

interface Props {
  segCounts: Record<Segment, number>
  distinctOutlets: string[]
  distinctLocs: string[]
  distinctDrinks: string[]
}

function parseParams(params: ReturnType<typeof useSearchParams>): FilterState {
  const parseScores = (v: string | null) =>
    (v ?? '').split(',').filter(Boolean).map(Number).filter(n => n >= 1 && n <= 5)
  const parseList = (v: string | null) =>
    (v ?? '').split(',').filter(Boolean)
  return {
    segment: ALL_SEGMENTS.includes(params.get('segment') as Segment) ? (params.get('segment') as Segment) : null,
    rfmR: parseScores(params.get('r')),
    rfmF: parseScores(params.get('f')),
    rfmM: parseScores(params.get('m')),
    time: params.get('time') ?? '',
    outlet: parseList(params.get('outlet')),
    loc: parseList(params.get('loc')),
    drink: parseList(params.get('drink')),
  }
}

function stateToSearch(s: FilterState): string {
  const p = new URLSearchParams()
  if (s.segment) p.set('segment', s.segment)
  if (s.rfmR.length) p.set('r', s.rfmR.join(','))
  if (s.rfmF.length) p.set('f', s.rfmF.join(','))
  if (s.rfmM.length) p.set('m', s.rfmM.join(','))
  if (s.time) p.set('time', s.time)
  if (s.outlet.length) p.set('outlet', s.outlet.join(','))
  if (s.loc.length) p.set('loc', s.loc.join(','))
  if (s.drink.length) p.set('drink', s.drink.join(','))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

function hasFilters(s: FilterState) {
  return !!(s.segment || s.rfmR.length || s.rfmF.length || s.rfmM.length || s.time || s.outlet.length || s.loc.length || s.drink.length)
}

function isDiff(a: FilterState, b: FilterState) {
  return JSON.stringify(a) !== JSON.stringify(b)
}

const EMPTY: FilterState = { segment: null, rfmR: [], rfmF: [], rfmM: [], time: '', outlet: [], loc: [], drink: [] }

export function FilterPanel({ segCounts, distinctOutlets, distinctLocs, distinctDrinks }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const applied = parseParams(params)
  const [pending, setPending] = useState<FilterState>(() => applied)

  const dirty      = isDiff(pending, applied)
  const anyApplied = hasFilters(applied)
  const anyPending = hasFilters(pending)

  const activeCount = [
    pending.segment ? 1 : 0,
    pending.rfmR.length ? 1 : 0,
    pending.rfmF.length ? 1 : 0,
    pending.rfmM.length ? 1 : 0,
    pending.time ? 1 : 0,
    pending.outlet.length ? 1 : 0,
    pending.loc.length ? 1 : 0,
    pending.drink.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  function apply() {
    router.push(`${pathname}${stateToSearch(pending)}`)
  }

  function discard() {
    setPending(applied)
  }

  function clearAll() {
    setPending(EMPTY)
    router.push(pathname)
  }

  function toggleRfm(dim: 'rfmR' | 'rfmF' | 'rfmM', value: number) {
    setPending(prev => {
      const cur = prev[dim]
      const next = cur.includes(value)
        ? cur.filter(v => v !== value)
        : [...cur, value].sort((a, b) => a - b)
      return { ...prev, [dim]: next }
    })
  }

  return (
    <div>
      {/* Segment chips */}
      <div className="mb-4">
        <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">Segment</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPending(prev => ({ ...prev, segment: null }))}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer ${
              !pending.segment
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
            }`}
          >
            All
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${!pending.segment ? 'bg-white/10' : 'bg-stone-800 text-stone-500'}`}>
              {ALL_SEGMENTS.reduce((s, seg) => s + segCounts[seg], 0).toLocaleString()}
            </span>
          </button>
          {ALL_SEGMENTS.map(seg => {
            const m = SEGMENT_META[seg]
            const isActive = seg === pending.segment
            return (
              <button
                key={seg}
                onClick={() => setPending(prev => ({ ...prev, segment: prev.segment === seg ? null : seg }))}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive ? m.chipActive : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
                }`}
              >
                <span className={`text-base leading-none ${m.color}`}>{m.emoji}</span>
                {seg}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums ${isActive ? 'bg-white/10' : 'bg-stone-800 text-stone-500'}`}>
                  {segCounts[seg].toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* RFM + Time row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* RFM */}
        <div>
          <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">RFM Filter</p>
          <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              {([
                { label: 'R', fullLabel: 'Recency',   dim: 'rfmR' as const, scores: pending.rfmR, lc: 'text-green-400', ac: 'bg-green-500/20 border-green-500/50 text-green-300' },
                { label: 'F', fullLabel: 'Frequency', dim: 'rfmF' as const, scores: pending.rfmF, lc: 'text-blue-400',  ac: 'bg-blue-500/20 border-blue-500/50 text-blue-300' },
                { label: 'M', fullLabel: 'Monetary',  dim: 'rfmM' as const, scores: pending.rfmM, lc: 'text-amber-400', ac: 'bg-amber-500/20 border-amber-500/50 text-amber-300' },
              ] as const).map(({ label, fullLabel, dim, scores, lc, ac }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-24">
                    <span className={`text-xs font-black font-mono ${lc}`}>{label}</span>
                    <span className="text-xs text-stone-600">{fullLabel}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => toggleRfm(dim, v)}
                        title={`${label} = ${v}`}
                        className={`w-7 h-7 rounded-lg text-xs font-bold font-mono border transition-all duration-150 cursor-pointer ${
                          scores.includes(v) ? ac : 'text-stone-500 bg-stone-800/60 border-stone-700 hover:border-stone-500 hover:text-stone-200'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {scores.length > 0 && (
                    <button
                      onClick={() => setPending(prev => ({ ...prev, [dim]: [] }))}
                      className="text-xs text-stone-600 hover:text-stone-400 transition-colors cursor-pointer ml-0.5"
                    >
                      clear
                    </button>
                  )}
                </div>
              ))}
              {(pending.rfmR.length > 0 || pending.rfmF.length > 0 || pending.rfmM.length > 0) && (
                <div className="ml-auto">
                  <button
                    onClick={() => setPending(prev => ({ ...prev, rfmR: [], rfmF: [], rfmM: [] }))}
                    className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 hover:text-stone-100 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                  >
                    <X size={10} /> Clear all
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-2.5">Select multiple values per dimension. Empty selection = show all.</p>
          </div>
        </div>

        {/* Time of day */}
        <div>
          <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold mb-2">Time of Day</p>
          <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {TIME_SLOTS.map(({ value, label, desc }) => {
                const isActive = pending.time === value
                return (
                  <button
                    key={value}
                    onClick={() => setPending(prev => ({ ...prev, time: prev.time === value ? '' : value }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : 'text-stone-500 bg-stone-800/60 border-stone-700 hover:border-stone-500 hover:text-stone-200'
                    }`}
                    title={desc}
                  >
                    {label}
                    <span className={`text-[10px] font-normal ${isActive ? 'text-sky-400/70' : 'text-stone-600'}`}>{desc}</span>
                  </button>
                )
              })}
              {pending.time && (
                <button
                  onClick={() => setPending(prev => ({ ...prev, time: '' }))}
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 hover:text-stone-100 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                >
                  <X size={10} /> Clear
                </button>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-2.5">Filter by customers' preferred ordering time. Single selection only.</p>
          </div>
        </div>
      </div>

      {/* Multi-select dropdowns + action bar */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold">Most Visited Outlet</p>
          <MultiSelectSearch
            options={distinctOutlets}
            selected={pending.outlet}
            onChange={vals => setPending(prev => ({ ...prev, outlet: vals }))}
            placeholder="All outlets"
            className="min-w-[180px]"
          />
        </div>
        {distinctLocs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold">Current Location</p>
            <MultiSelectSearch
              options={distinctLocs}
              selected={pending.loc}
              onChange={vals => setPending(prev => ({ ...prev, loc: vals }))}
              placeholder="All locations"
              className="min-w-[180px]"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-stone-600 uppercase tracking-wide font-semibold">Favourite Drink</p>
          <MultiSelectSearch
            options={distinctDrinks}
            selected={pending.drink}
            onChange={vals => setPending(prev => ({ ...prev, drink: vals }))}
            placeholder="All drinks"
            className="min-w-[200px]"
          />
        </div>

        {/* Action buttons */}
        {dirty ? (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={apply}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer"
            >
              <SlidersHorizontal size={12} />
              Apply{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <button
              onClick={discard}
              className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer"
            >
              Discard
            </button>
          </div>
        ) : (anyApplied || anyPending) ? (
          <div className="ml-auto">
            <button
              onClick={clearAll}
              className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
