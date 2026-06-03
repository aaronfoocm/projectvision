'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, Loader2, MessageSquare } from 'lucide-react'
import { getActionBatchDownload } from '@/actions/journey'
import { ActionRow } from './ActionRow'

interface ActionRecord {
  id: number
  action_date: string
  action_type: string
  channel: string
  message_template: string
  resolved_message: string
  customers: { crm_id: string; first_name: string | null; last_name: string | null; segment: string | null } | null
}

interface Props {
  template: string
  actionType: string
  channel: string
  sampleMessage: string
  actions: ActionRecord[]
}

function customerName(a: ActionRecord) {
  return [a.customers?.first_name, a.customers?.last_name].filter(Boolean).join(' ') || 'Unknown'
}

function toCsv(rows: { phone: string; name: string; message: string }[]): string {
  const header = 'phone,name,message'
  const lines = rows.map(r =>
    [r.phone, r.name, r.message].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...lines].join('\n')
}

export function ActionBatch({ template, actionType, channel, sampleMessage, actions }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const rows = await getActionBatchDownload(template)
      const csv = toCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${template}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="border border-stone-800 rounded-2xl overflow-hidden mb-3">
      <div className="bg-stone-900 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/25 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare size={16} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-semibold text-sm">{actionType}</p>
                <span className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">{channel}</span>
                <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
                  {actions.length} customer{actions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 font-mono truncate">{template}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-40"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {downloading ? 'Exporting…' : 'Download CSV'}
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-stone-500 hover:text-stone-300 transition-colors p-1"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-3 bg-stone-950 border border-stone-800 rounded-lg px-4 py-3 text-xs text-stone-400 leading-relaxed line-clamp-2">
          {sampleMessage}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 bg-stone-950 border-t border-stone-800">
          {actions.map(a => (
            <ActionRow
              key={a.id}
              id={a.id}
              customerName={customerName(a)}
              segment={a.customers?.segment ?? ''}
              channel={a.channel}
              template={a.message_template}
              resolvedMessage={a.resolved_message}
              isOverdue={a.action_date < new Date().toISOString().slice(0, 10)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
