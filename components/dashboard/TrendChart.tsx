'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TrendPoint {
  date: string
  Regular: number
  Flickerer: number
  Ghost: number
  Dormant: number
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716c' }} />
        <YAxis tick={{ fontSize: 10, fill: '#78716c' }} />
        <Tooltip
          contentStyle={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#a8a29e' }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#a8a29e' }} />
        <Bar dataKey="Regular"   stackId="a" fill="#4ade80" />
        <Bar dataKey="Flickerer" stackId="a" fill="#fb923c" />
        <Bar dataKey="Ghost"     stackId="a" fill="#f87171" />
        <Bar dataKey="Dormant"   stackId="a" fill="#78716c" radius={[2,2,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
