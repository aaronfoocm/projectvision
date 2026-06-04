import { DrinkDNA } from './DrinkDNA'
import { SEGMENT_META } from '@/lib/segment-meta'

interface Props {
  crm_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  segment: string | null
  rfm_r: number | null
  rfm_f: number | null
  rfm_m: number | null
  preferred_temp?: string | null
  preferred_time_slot?: string | null
  preferred_milk?: string | null
  favourite_drink?: string | null
}

export function CustomerCard(props: Props) {
  const { crm_id, first_name, last_name, email, segment, rfm_r, rfm_f, rfm_m } = props
  const name = [first_name, last_name].filter(Boolean).join(' ') || crm_id
  const meta = segment
    ? (SEGMENT_META[segment as keyof typeof SEGMENT_META] ?? SEGMENT_META.Dormant)
    : SEGMENT_META.Dormant

  return (
    <a
      href={`/dashboard/customers/${crm_id}`}
      className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-stone-600 hover:bg-stone-800/50 transition-all duration-150 block cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{name}</p>
            <p className="text-xs text-stone-500 mt-0.5 truncate max-w-[140px]">{email ?? '-'}</p>
          </div>
        </div>
        {segment && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.badge} flex-shrink-0`}>
            {meta.emoji} {segment}
          </span>
        )}
      </div>
      <DrinkDNA
        preferred_temp={props.preferred_temp}
        preferred_time_slot={props.preferred_time_slot}
        preferred_milk={props.preferred_milk}
        favourite_drink={props.favourite_drink}
      />
      {(rfm_r != null || rfm_f != null || rfm_m != null) && (
        <div className="mt-2.5 text-xs text-stone-500">
          RFM{' '}
          <span className="font-mono tabular-nums">
            <span className="text-green-400 font-semibold">{rfm_r ?? '-'}</span>
            <span className="text-stone-600">-</span>
            <span className="text-blue-400 font-semibold">{rfm_f ?? '-'}</span>
            <span className="text-stone-600">-</span>
            <span className="text-amber-400 font-semibold">{rfm_m ?? '-'}</span>
          </span>
        </div>
      )}
    </a>
  )
}
