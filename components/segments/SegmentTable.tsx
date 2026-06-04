'use client'
import { useState } from 'react'
import { Download, Loader2, ExternalLink } from 'lucide-react'
import { exportSegmentCSV } from '@/actions/segments'

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

const SEGMENT_COLORS: Record<string, string> = {
  Regular:    'bg-green-500/15 text-green-400 border-green-500/25',
  Explorer:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Flickerer:  'bg-orange-500/15 text-orange-400 border-orange-500/25',
  Ghost:      'bg-red-500/15 text-red-400 border-red-500/25',
  Hoarder:    'bg-purple-500/15 text-purple-400 border-purple-500/25',
  GroupBuyer: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  Dormant:    'bg-stone-500/15 text-stone-400 border-stone-500/25',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

function formatMobile(m: string | null) {
  if (!m) return '—'
  // Malaysian: 601X → +60 1X-XXXX-XXXX
  return `+${m}`
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
  const [exporting, setExporting] = useState(false)

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

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
        <div>
          <p className="text-white font-semibold text-sm">{segment} customers</p>
          <p className="text-stone-500 text-xs mt-0.5">
            Showing {customers.length.toLocaleString()} of {total.toLocaleString()}
            {total > customers.length && ' — export for full list'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-500/25 transition-colors duration-150 disabled:opacity-40 cursor-pointer"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {exporting ? `Exporting ${total.toLocaleString()}…` : `Export CSV (${total.toLocaleString()})`}
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <p className="text-sm">No customers in this segment yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 text-xs uppercase tracking-wide border-b border-stone-800 bg-stone-900/50">
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Mobile</th>
                <th className="text-left px-4 py-3 font-medium">Segment</th>
                <th className="text-right px-4 py-3 font-medium">Visits</th>
                <th className="text-right px-4 py-3 font-medium">Last Visit</th>
                <th className="text-right px-4 py-3 font-medium">Avg Gap</th>
                <th className="text-right px-4 py-3 font-medium">Points</th>
                <th className="text-right px-4 py-3 font-medium">RFM</th>
                <th className="text-left px-4 py-3 font-medium">Fav Drink</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {customers.map(c => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.crm_id
                const segColor = SEGMENT_COLORS[c.segment ?? ''] ?? SEGMENT_COLORS.Dormant
                return (
                  <tr
                    key={c.crm_id}
                    className="hover:bg-stone-800/40 transition-colors duration-100 group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="text-white font-medium text-sm">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs font-mono">{formatMobile(c.mobile)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${segColor}`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-300 tabular-nums">{c.total_visits ?? 0}</td>
                    <td className="px-4 py-3 text-right text-stone-400 text-xs">{formatDate(c.last_visit_date)}</td>
                    <td className="px-4 py-3 text-right text-stone-400 text-xs">
                      {c.avg_gap_days ? `${Math.round(c.avg_gap_days)}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-semibold tabular-nums text-xs">
                      {(c.points_balance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.rfm_r != null
                        ? <span className="text-xs font-mono text-stone-400">
                            <span className="text-green-400">{c.rfm_r}</span>-<span className="text-blue-400">{c.rfm_f}</span>-<span className="text-amber-400">{c.rfm_m}</span>
                          </span>
                        : <span className="text-stone-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs max-w-[160px] truncate">
                      {c.favourite_item ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/dashboard/customers/${c.crm_id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-stone-500 hover:text-white"
                        title="View profile"
                      >
                        <ExternalLink size={13} />
                      </a>
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
