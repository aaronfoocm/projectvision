'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, useEffect, useTransition } from 'react'

export function SearchBar({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set('q', value)
      else next.delete('q')
      startTransition(() => router.push(`${pathname}?${next.toString()}`))
    }, 300)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
      <input
        type="search"
        placeholder="Search by name, email or mobile..."
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full bg-stone-900 border border-stone-800 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
      />
    </div>
  )
}
