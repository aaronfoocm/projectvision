'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  param: string
  options: string[]
  placeholder: string
  className?: string
}

export function DropdownFilter({ param, options, placeholder, className = '' }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const current  = params.get(param) ?? ''

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString())
    if (e.target.value) next.set(param, e.target.value)
    else next.delete(param)
    next.delete('page') // reset pagination on filter change
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className={`text-xs bg-stone-900 border border-stone-700 text-stone-300 rounded-lg px-3 py-2 cursor-pointer hover:border-stone-500 transition-colors duration-150 focus:outline-none focus:border-amber-500/50 ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
