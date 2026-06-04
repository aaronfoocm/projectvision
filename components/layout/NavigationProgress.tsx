'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const prevKey    = useRef(pathname + searchParams.toString())
  const doneTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Intercept any internal link click → show indicator
  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as Element).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (!href || href.startsWith('#') || href.startsWith('http') || a.target === '_blank') return
      setDone(false)
      setLoading(true)
    }
    document.addEventListener('click', onAnchorClick)
    return () => document.removeEventListener('click', onAnchorClick)
  }, [])

  // When pathname/search settles → complete then hide
  useEffect(() => {
    const key = pathname + searchParams.toString()
    if (key !== prevKey.current) {
      prevKey.current = key
      setDone(true)
      if (doneTimer.current) clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(() => {
        setLoading(false)
        setDone(false)
      }, 500)
    }
  }, [pathname, searchParams])

  // Change cursor while loading
  useEffect(() => {
    if (loading && !done) {
      document.body.style.cursor = 'wait'
    } else {
      document.body.style.cursor = ''
    }
    return () => { document.body.style.cursor = '' }
  }, [loading, done])

  if (!loading) return null

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-amber-500/20 pointer-events-none">
        <div
          className={`h-full bg-amber-500 transition-all ${done ? 'duration-500 w-full opacity-0' : 'opacity-100'}`}
          style={done ? undefined : {
            animation: 'nav-progress 8s cubic-bezier(0.1, 0.3, 0.3, 1) forwards',
          }}
        />
      </div>

      {/* Floating spinner — bottom-right corner */}
      <div
        className={`fixed bottom-6 right-6 z-[200] pointer-events-none transition-opacity duration-300 ${
          done ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="relative w-10 h-10">
          {/* Track */}
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(245 158 11 / 0.15)" strokeWidth="3" />
          </svg>
          {/* Spinning arc */}
          <svg className="w-10 h-10 -rotate-90 absolute inset-0 animate-spin" viewBox="0 0 40 40"
            style={{ animationDuration: '700ms' }}>
            <circle
              cx="20" cy="20" r="16"
              fill="none"
              stroke="rgb(245 158 11)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="60 44"
            />
          </svg>
        </div>
      </div>
    </>
  )
}
