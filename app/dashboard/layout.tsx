import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LayoutDashboard, Zap, Users, Upload, Coffee } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/actions', label: 'Actions', icon: Zap },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-stone-950">
      <aside className="w-56 bg-stone-900 border-r border-stone-800 flex flex-col fixed inset-y-0">
        <div className="px-4 py-5 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Coffee size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">Project Vision</p>
              <p className="text-stone-400 text-xs">Koppiku CRM</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <p className="text-xs text-stone-400 truncate flex-1">{user.email}</p>
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-56 min-h-screen">{children}</main>
    </div>
  )
}
