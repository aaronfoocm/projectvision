'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, Users, Upload, DatabaseZap, PieChart, LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  '/dashboard':          LayoutDashboard,
  '/dashboard/actions':  Zap,
  '/dashboard/segments': PieChart,
  '/dashboard/customers':Users,
  '/dashboard/upload':   Upload,
  '/dashboard/database': DatabaseZap,
}

interface Props {
  href: string
  label: string
}

export function NavLink({ href, label }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const Icon = ICONS[href]

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
        isActive
          ? 'bg-amber-500/15 border border-amber-500/25 text-amber-300 font-medium'
          : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100 font-normal border border-transparent'
      }`}
    >
      {Icon && <Icon size={16} className={isActive ? 'text-amber-400' : 'text-stone-500'} />}
      {label}
    </Link>
  )
}
