'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function OutletSelect({ outlets }: { outlets: string[] }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const params      = useSearchParams()
  const current     = params.get('outlet') ?? ''

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString())
    if (e.target.value) next.set('outlet', e.target.value)
    else next.delete('outlet')
    // Reset to first page if paginated
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="text-xs bg-stone-900 border border-stone-700 text-stone-300 rounded-lg px-3 py-1.5 cursor-pointer hover:border-stone-500 transition-colors duration-150 focus:outline-none focus:border-amber-500/50 min-w-[160px]"
    >
      <option value="">All outlets</option>
      {outlets.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
