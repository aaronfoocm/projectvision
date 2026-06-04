'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const prevKey = useRef(pathname + searchParams.toString())
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Intercept any internal link click → show bar
  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as Element).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      // Only internal non-hash links
      if (!href || href.startsWith('#') || href.startsWith('http') || a.target === '_blank') return
      setDone(false)
      setLoading(true)
    }
    document.addEventListener('click', onAnchorClick)
    return () => document.removeEventListener('click', onAnchorClick)
  }, [])

  // When pathname settles → complete and fade out
  useEffect(() => {
    const key = pathname + searchParams.toString()
    if (key !== prevKey.current) {
      prevKey.current = key
      setDone(true)
      if (doneTimer.current) clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(() => {
        setLoading(false)
        setDone(false)
      }, 400)
    }
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-amber-500/20 pointer-events-none">
      <div
        className={`h-full bg-amber-500 transition-all ${done ? 'duration-300 w-full opacity-0' : 'opacity-100'}`}
        style={done ? undefined : {
          animation: 'nav-progress 8s cubic-bezier(0.1, 0.3, 0.3, 1) forwards',
        }}
      />
    </div>
  )
}
