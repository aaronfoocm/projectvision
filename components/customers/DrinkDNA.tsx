const TEMP_LABELS: Record<string, string> = {
  ICED: '🧊 ICED', HOT: '🔥 HOT', BOTH: '🌡️ Both',
}
const TIME_LABELS: Record<string, string> = {
  MORNING: '🌅 Morning', AFTERNOON: '☀️ Afternoon', EVENING: '🌆 Evening', NIGHT: '🌙 Night',
}

interface Props {
  preferred_temp?: string | null
  preferred_time_slot?: string | null
  preferred_milk?: string | null
  favourite_drink?: string | null
  preferred_size?: string | null
}

export function DrinkDNA({ preferred_temp, preferred_time_slot, preferred_milk, favourite_drink, preferred_size }: Props) {
  const tags = [
    preferred_temp && TEMP_LABELS[preferred_temp],
    preferred_time_slot && TIME_LABELS[preferred_time_slot],
    preferred_milk && `🥛 ${preferred_milk}`,
    preferred_size && `📏 ${preferred_size}`,
    favourite_drink && `☕ ${favourite_drink}`,
  ].filter(Boolean) as string[]

  if (!tags.length) return <span className="text-xs text-stone-600">No drink data yet</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span key={tag} className="text-xs bg-stone-800 border border-stone-700 text-stone-300 px-2.5 py-0.5 rounded-full">
          {tag}
        </span>
      ))}
    </div>
  )
}
