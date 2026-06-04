import { SEGMENT_META } from '@/lib/segment-meta'
import type { Segment } from '@/lib/types'

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
      className={`${meta.bg} border ${meta.border} rounded-xl p-4 text-center hover:brightness-110 transition-all duration-150 block cursor-pointer`}
    >
      <div className={`text-2xl font-bold font-mono tabular-nums ${meta.color}`}>
        {count.toLocaleString()}
      </div>
      <div className="text-xs font-semibold text-stone-300 mt-1.5">
        {meta.emoji} {meta.label}
      </div>
    </a>
  )
}
