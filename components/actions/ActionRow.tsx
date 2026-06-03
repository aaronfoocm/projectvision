'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { markActionDone } from '@/actions/journey'

const SEGMENT_EMOJI: Record<string, string> = {
  Regular: '⭐', Explorer: '🧭', Flickerer: '🎯',
  Ghost: '👻', Hoarder: '💰', GroupBuyer: '👥', Dormant: '💤',
}

interface Props {
  id: number
  customerName: string
  segment: string
  channel: string
  template: string
  resolvedMessage: string
  isOverdue: boolean
}

export function ActionRow({ id, customerName, segment, channel, template, resolvedMessage, isOverdue }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDone() {
    if (!outcome) return
    setLoading(true)
    await markActionDone(id, outcome as 'redeemed' | 'visited' | 'no_response')
    setDone(true)
    setLoading(false)
  }

  if (done) return null

  return (
    <div className={`border rounded-xl overflow-hidden mb-2 ${isOverdue ? 'border-orange-500/30' : 'border-stone-800'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isOverdue ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'bg-stone-900 hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {customerName[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{customerName}</p>
            <p className="text-xs text-stone-400">
              {SEGMENT_EMOJI[segment] ?? ''} {segment} · {channel} · {template}
              {isOverdue && <span className="ml-2 text-orange-400 font-medium">overdue</span>}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-stone-500" /> : <ChevronDown size={16} className="text-stone-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-stone-950 border-t border-stone-800">
          <p className="text-xs text-stone-500 font-semibold uppercase mb-2">Message preview</p>
          <div className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-3 text-sm text-stone-200 leading-relaxed mb-3">
            {resolvedMessage}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="flex-1 bg-stone-800 border border-stone-700 text-stone-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="">Select outcome...</option>
              <option value="redeemed">Redeemed</option>
              <option value="visited">Visited (no redeem)</option>
              <option value="no_response">No response</option>
            </select>
            <button
              onClick={handleDone}
              disabled={!outcome || loading}
              className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-40"
            >
              <CheckCircle size={14} />
              {loading ? 'Saving...' : 'Mark done'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
