'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Coffee, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.refresh()
    router.push('/dashboard/segments')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Coffee size={28} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Project Vision</h1>
          <p className="text-stone-400 text-sm mt-1">Koppiku Customer Intelligence</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-stone-300 text-xs font-medium">Email</label>
            <input
              type="email"
              placeholder="you@koppiku.my"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-stone-300 text-xs font-medium">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Signing in...</>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
