import { DrinkDNA } from './DrinkDNA'

const SEGMENT_COLORS: Record<string, string> = {
  Regular:    'bg-green-500/15 text-green-400 border-green-500/30',
  Explorer:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Flickerer:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Ghost:      'bg-red-500/15 text-red-400 border-red-500/30',
  Hoarder:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  GroupBuyer: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Dormant:    'bg-stone-500/15 text-stone-400 border-stone-500/30',
}
const SEGMENT_EMOJI: Record<string, string> = {
  Regular: '⭐', Explorer: '🧭', Flickerer: '🎯',
  Ghost: '👻', Hoarder: '💰', GroupBuyer: '👥', Dormant: '💤',
}

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
  const segColor = segment ? (SEGMENT_COLORS[segment] ?? SEGMENT_COLORS.Dormant) : SEGMENT_COLORS.Dormant
  const segEmoji = segment ? (SEGMENT_EMOJI[segment] ?? '') : ''

  return (
    <a
      href={`/dashboard/customers/${crm_id}`}
      className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-stone-600 transition-colors block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{name}</p>
            <p className="text-xs text-stone-500 mt-0.5 truncate max-w-[140px]">{email ?? '—'}</p>
          </div>
        </div>
        {segment && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${segColor}`}>
            {segEmoji} {segment}
          </span>
        )}
      </div>
      <DrinkDNA
        preferred_temp={props.preferred_temp}
        preferred_time_slot={props.preferred_time_slot}
        preferred_milk={props.preferred_milk}
        favourite_drink={props.favourite_drink}
      />
      {(rfm_r || rfm_f || rfm_m) && (
        <div className="mt-2 text-xs text-stone-500">
          RFM <span className="text-amber-400 font-semibold">{rfm_r}-{rfm_f}-{rfm_m}</span>
        </div>
      )}
    </a>
  )
}
