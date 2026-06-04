'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { exportSegmentCSV } from '@/actions/segments'
import { SEGMENT_META } from '@/lib/segment-meta'

interface Customer {
  crm_id: string
  first_name: string | null
  last_name: string | null
  mobile: string | null
  segment: string | null
  rfm_r: number | null
  rfm_f: number | null
  rfm_m: number | null
  total_visits: number | null
  last_visit_date: string | null
  avg_gap_days: number | null
  points_balance: number | null
  outlet_count: number | null
  favourite_item: string | null
}

type SortKey = 'name' | 'visits' | 'last_visit' | 'avg_gap' | 'points' | 'rfm'
type SortDir = 'asc' | 'desc'

function formatDate(d: string | null) {
  if (!d) return null
  return String(d).slice(0, 10)
}

function rfmScore(c: Customer) {
  return (c.rfm_r ?? 0) + (c.rfm_f ?? 0) + (c.rfm_m ?? 0)
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-stone-700 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="text-amber-400 ml-1 inline" />
    : <ChevronDown size={11} className="text-amber-400 ml-1 inline" />
}

interface Props {
  customers: Customer[]
  total: number
  segment: string
  rfmR: number[]
  rfmF: number[]
  rfmM: number[]
}

export function SegmentTable({ customers, total, segment, rfmR, rfmF, rfmM }: Props) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('visits')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...customers].sort((a, b) => {
    let va: number | string = 0
    let vb: number | string = 0
    if (sortKey === 'name') {
      va = [a.first_name, a.last_name].filter(Boolean).join(' ').toLowerCase()
      vb = [b.first_name, b.last_name].filter(Boolean).join(' ').toLowerCase()
    } else if (sortKey === 'visits') {
      va = a.total_visits ?? 0; vb = b.total_visits ?? 0
    } else if (sortKey === 'last_visit') {
      va = a.last_visit_date ?? ''; vb = b.last_visit_date ?? ''
    } else if (sortKey === 'avg_gap') {
      va = a.avg_gap_days ?? 0; vb = b.avg_gap_days ?? 0
    } else if (sortKey === 'points') {
      va = a.points_balance ?? 0; vb = b.points_balance ?? 0
    } else if (sortKey === 'rfm') {
      va = rfmScore(a); vb = rfmScore(b)
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportSegmentCSV(segment, rfmR, rfmF, rfmM)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${segment.toLowerCase()}-customers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function SortTh({ label, col, align = 'right' }: { label: string; col: SortKey; align?: 'left' | 'right' }) {
    return (
      <th className={`px-4 py-3 font-medium text-${align}`}>
        <button
          onClick={() => toggleSort(col)}
          className="inline-flex items-center gap-0.5 hover:text-stone-300 transition-colors duration-150 cursor-pointer"
        >
          {label}
          <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
        </button>
      </th>
    )
  }

  const isTruncated = customers.length < total

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
        <div>
          <p className="text-white font-semibold text-sm">{segment} customers</p>
          <p className="text-stone-500 text-xs mt-0.5 tabular-nums">
            Showing {customers.length.toLocaleString()} of {total.toLocaleString()}
            {isTruncated && (
              <span className="text-amber-500/80"> — export CSV for full list</span>
            )}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-500/25 transition-colors duration-150 disabled:opacity-40 cursor-pointer"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {exporting ? `Exporting ${total.toLocaleString()}...` : `Export CSV (${total.toLocaleString()})`}
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-600 text-3xl mb-3">0</p>
          <p className="text-stone-400 font-semibold text-sm">No customers in this segment</p>
          <p className="text-stone-600 text-xs mt-1.5 max-w-xs mx-auto">
            {rfmR.length || rfmF.length || rfmM.length
              ? 'Try removing some RFM filters — the combination may yield no matches.'
              : 'Upload a new CSV to populate this segment, or customers may have moved to another segment.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 text-xs uppercase tracking-wide border-b border-stone-800 bg-stone-950/40">
                <SortTh label="Customer" col="name" align="left" />
                <th className="text-left px-4 py-3 font-medium">Mobile</th>
                <th className="text-left px-4 py-3 font-medium">Segment</th>
                <SortTh label="Visits" col="visits" />
                <SortTh label="Last Visit" col="last_visit" />
                <SortTh label="Avg Gap" col="avg_gap" />
                <SortTh label="Points" col="points" />
                <SortTh label="RFM" col="rfm" />
                <th className="text-left px-4 py-3 font-medium">Fav Drink</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {sorted.map(c => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.crm_id
                const meta = SEGMENT_META[c.segment as keyof typeof SEGMENT_META] ?? SEGMENT_META.Dormant
                const visitDate = formatDate(c.last_visit_date)
                return (
                  <tr
                    key={c.crm_id}
                    onClick={() => router.push(`/dashboard/customers/${c.crm_id}`)}
                    className="hover:bg-stone-800/50 transition-colors duration-100 group cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="text-white font-medium text-sm">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs font-mono tabular-nums">
                      {c.mobile ? `+${c.mobile}` : <span className="text-stone-600">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-300 tabular-nums font-mono text-xs">
                      {c.total_visits ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-400 text-xs tabular-nums">
                      {visitDate ?? <span className="text-stone-600">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-400 text-xs tabular-nums">
                      {c.avg_gap_days ? `${Math.round(c.avg_gap_days)}d` : <span className="text-stone-600">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-semibold tabular-nums font-mono text-xs">
                      {(c.points_balance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.rfm_r != null
                        ? <span className="text-xs font-mono tabular-nums">
                            <span className="text-green-400">{c.rfm_r}</span>
                            <span className="text-stone-600">-</span>
                            <span className="text-blue-400">{c.rfm_f}</span>
                            <span className="text-stone-600">-</span>
                            <span className="text-amber-400">{c.rfm_m}</span>
                          </span>
                        : <span className="text-stone-600 text-xs">-</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs max-w-[160px] truncate">
                      {c.favourite_item ?? <span className="text-stone-600">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ExternalLink size={13} className="opacity-0 group-hover:opacity-60 transition-opacity duration-150 text-stone-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
