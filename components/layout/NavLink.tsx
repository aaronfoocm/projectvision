'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface Props {
  href: string
  label: string
  icon: LucideIcon
}

export function NavLink({ href, label, icon: Icon }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
        isActive
          ? 'bg-amber-500/15 border border-amber-500/25 text-amber-300 font-medium'
          : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100 font-normal border border-transparent'
      }`}
    >
      <Icon size={16} className={isActive ? 'text-amber-400' : 'text-stone-500'} />
      {label}
    </Link>
  )
}
