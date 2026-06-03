'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const CHIP_GROUPS = [
  {
    param: 'temp',
    options: [
      { value: '', label: 'All temps' },
      { value: 'ICED', label: '🧊 ICED' },
      { value: 'HOT', label: '🔥 HOT' },
    ],
  },
  {
    param: 'time',
    options: [
      { value: '', label: 'All times' },
      { value: 'MORNING', label: '🌅 Morning' },
      { value: 'AFTERNOON', label: '☀️ Afternoon' },
      { value: 'EVENING', label: '🌆 Evening' },
      { value: 'NIGHT', label: '🌙 Night' },
    ],
  },
  {
    param: 'milk',
    options: [
      { value: '', label: 'All milk' },
      { value: 'Oat Milk', label: '🥛 Oat' },
      { value: 'Coconut Milk', label: '🥥 Coconut' },
    ],
  },
]

export function FilterChips() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function toggle(param: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === '') next.delete(param)
    else next.set(param, value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 mb-6">
      <span className="text-xs text-stone-500 uppercase tracking-wide mr-1">Filter</span>
      {CHIP_GROUPS.map((group, gi) => (
        <div key={group.param} className="flex items-center gap-1.5">
          {gi > 0 && <div className="w-px h-4 bg-stone-700 mx-1" />}
          {group.options.map(opt => {
            const active = (params.get(group.param) ?? '') === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => toggle(group.param, opt.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                    : 'border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
