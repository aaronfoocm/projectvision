'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface DimProps {
  label: string
  param: 'r' | 'f' | 'm'
  activeClass: string
  labelClass: string
}

function RfmDim({ label, param, activeClass, labelClass }: DimProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const current = (params.get(param) ?? '').split(',').filter(Boolean).map(Number)

  function toggle(value: number) {
    const next = new URLSearchParams(params.toString())
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value].sort((a, b) => a - b)
    if (updated.length === 0) next.delete(param)
    else next.set(param, updated.join(','))
    router.push(`${pathname}?${next.toString()}`)
  }

  function clear() {
    const next = new URLSearchParams(params.toString())
    next.delete(param)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-black font-mono w-4 ${labelClass}`}>{label}</span>
      {[1, 2, 3, 4, 5].map(v => {
        const isActive = current.includes(v)
        return (
          <button
            key={v}
            onClick={() => toggle(v)}
            title={`${label} = ${v}`}
            className={`w-7 h-7 rounded-lg text-xs font-bold font-mono border transition-all duration-150 cursor-pointer ${
              isActive ? activeClass : 'text-stone-500 bg-stone-800/60 border-stone-700 hover:border-stone-500 hover:text-stone-300'
            }`}
          >
            {v}
          </button>
        )
      })}
      {current.length > 0 && (
        <button
          onClick={clear}
          className="text-xs text-stone-600 hover:text-stone-400 transition-colors ml-1 cursor-pointer"
        >
          clear
        </button>
      )}
    </div>
  )
}

function ClearAllButton() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const hasAny = ['r', 'f', 'm'].some(p => params.get(p))
  if (!hasAny) return null

  function clearAll() {
    const next = new URLSearchParams(params.toString())
    next.delete('r'); next.delete('f'); next.delete('m')
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <button
      onClick={clearAll}
      className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-stone-400 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 hover:text-white px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 2l8 8M10 2l-8 8" />
      </svg>
      Clear all filters
    </button>
  )
}

export function RfmFilterChips() {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2.5">
      <span className="text-xs text-stone-500 uppercase tracking-wide font-semibold">RFM filter</span>
      <RfmDim label="R" param="r" labelClass="text-green-400" activeClass="bg-green-500/20 border-green-500/50 text-green-300" />
      <RfmDim label="F" param="f" labelClass="text-blue-400"  activeClass="bg-blue-500/20 border-blue-500/50 text-blue-300" />
      <RfmDim label="M" param="m" labelClass="text-amber-400" activeClass="bg-amber-500/20 border-amber-500/50 text-amber-300" />
      <ClearAllButton />
      <span className="text-xs text-stone-600 w-full">Select multiple values per dimension · empty = show all</span>
    </div>
  )
}
