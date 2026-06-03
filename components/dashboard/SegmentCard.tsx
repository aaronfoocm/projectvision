import type { Segment } from '@/lib/types'

const SEGMENT_META: Record<Segment, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  Regular:    { label: 'Regular',    emoji: '⭐', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25' },
  Explorer:   { label: 'Explorer',   emoji: '🧭', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25' },
  Flickerer:  { label: 'Flickerer',  emoji: '🎯', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
  Ghost:      { label: 'Ghost',      emoji: '👻', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25' },
  Hoarder:    { label: 'Hoarder',    emoji: '💰', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
  GroupBuyer: { label: 'Group',      emoji: '👥', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' },
  Dormant:    { label: 'Dormant',    emoji: '💤', color: 'text-stone-400',  bg: 'bg-stone-500/10',  border: 'border-stone-500/25' },
}

interface Props {
  segment: Segment
  count: number
  href: string
}

export function SegmentCard({ segment, count, href }: Props) {
  const meta = SEGMENT_META[segment]
  return (
    <a
      href={href}
      className={`${meta.bg} border ${meta.border} rounded-xl p-4 text-center hover:brightness-125 transition-all block`}
    >
      <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
      <div className="text-xs font-semibold text-white mt-1">{meta.emoji} {meta.label}</div>
    </a>
  )
}
