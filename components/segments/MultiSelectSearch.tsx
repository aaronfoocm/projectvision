'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface Props {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder: string
  className?: string
}

export function MultiSelectSearch({ options, selected, onChange, placeholder, className = '' }: Props) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`

  const hasSelection = selected.length > 0

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2 transition-colors duration-150 cursor-pointer focus:outline-none ${
          hasSelection
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:border-amber-500/60'
            : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300'
        }`}
      >
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasSelection && (
            <span
              role="button"
              tabIndex={-1}
              onClick={e => { e.stopPropagation(); onChange([]) }}
              className="text-stone-500 hover:text-stone-300 transition-colors"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={11}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${hasSelection ? 'text-amber-400/60' : 'text-stone-600'}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-full w-max max-w-[280px] bg-stone-950 border border-stone-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-800">
            <Search size={11} className="text-stone-500 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-stone-300 placeholder-stone-600 outline-none min-w-0"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-stone-600 hover:text-stone-400 flex-shrink-0">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Option list */}
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="text-xs text-stone-600 px-3 py-3 text-center">No matches</p>
            ) : (
              filtered.map(o => {
                const isSelected = selected.includes(o)
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggle(o)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors duration-100 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-amber-500/30 border-amber-500/60' : 'border-stone-600'
                    }`}>
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 4l2 2 3-3" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {hasSelection && (
            <div className="border-t border-stone-800 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-stone-500">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
