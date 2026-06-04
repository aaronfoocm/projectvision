'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const TIME_SLOTS = [
  { value: 'MORNING',   label: 'Morning',   desc: 'Before noon' },
  { value: 'AFTERNOON', label: 'Afternoon', desc: '12pm – 5pm' },
  { value: 'EVENING',   label: 'Evening',   desc: '5pm – 9pm' },
  { value: 'NIGHT',     label: 'Night',     desc: 'After 9pm' },
]

export function TimeFilterChips() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const active   = params.get('time') ?? ''

  function select(value: string) {
    const next = new URLSearchParams(params.toString())
    if (active === value) next.delete('time')
    else next.set('time', value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {TIME_SLOTS.map(({ value, label, desc }) => {
          const isActive = active === value
          return (
            <button
              key={value}
              onClick={() => select(value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'text-stone-500 bg-stone-800/60 border-stone-700 hover:border-stone-500 hover:text-stone-200'
              }`}
              title={desc}
            >
              {label}
              <span className={`text-[10px] font-normal ${isActive ? 'text-sky-400/70' : 'text-stone-600'}`}>{desc}</span>
            </button>
          )
        })}
        {active && (
          <button
            onClick={() => select(active)}
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 hover:text-stone-100 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
            </svg>
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-stone-600 mt-2.5">Filter by customers' preferred ordering time. Single selection only.</p>
    </div>
  )
}
