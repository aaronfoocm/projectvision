import { createClient } from '@/lib/supabase/server'

// ── Calendar builder ─────────────────────────────────────────────────────────
function buildWeeks(today: Date): { date: Date; iso: string }[][] {
  // Start on the Sunday at or before (today − 364 days)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  start.setDate(start.getDate() - start.getDay()) // rewind to Sunday

  const weeks: { date: Date; iso: string }[][] = []
  const cur = new Date(start)

  while (cur <= today) {
    const week: { date: Date; iso: string }[] = []
    for (let d = 0; d < 7; d++) {
      week.push({ date: new Date(cur), iso: cur.toISOString().slice(0, 10) })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function cellColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'bg-stone-800'
  const ratio = count / max
  if (ratio < 0.15) return 'bg-amber-950'
  if (ratio < 0.35) return 'bg-amber-800'
  if (ratio < 0.60) return 'bg-amber-600'
  if (ratio < 0.85) return 'bg-amber-400'
  return 'bg-amber-300'
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function DatabasePage() {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yearAgo = new Date(today)
  yearAgo.setDate(yearAgo.getDate() - 364)

  const [
    { data: txnDates },
    { count: totalCustomers },
    { count: totalTransactions },
    { data: uploadLog },
    { data: dateRange },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('transaction_date')
      .gte('transaction_date', yearAgo.toISOString().slice(0, 10)),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase
      .from('upload_log')
      .select('file_type, row_count, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('transactions')
      .select('transaction_date')
      .not('transaction_date', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(1),
  ])

  // Count transactions per calendar date
  const countByDate = new Map<string, number>()
  for (const t of txnDates ?? []) {
    if (!t.transaction_date) continue
    const iso = String(t.transaction_date).slice(0, 10)
    countByDate.set(iso, (countByDate.get(iso) ?? 0) + 1)
  }

  const maxCount = Math.max(0, ...countByDate.values())
  const weeks = buildWeeks(today)

  const lastTxnDate = dateRange?.[0]?.transaction_date
    ? String(dateRange[0].transaction_date).slice(0, 10)
    : null

  const todayIso = today.toISOString().slice(0, 10)
  const daysSinceUpdate = lastTxnDate
    ? Math.floor((today.getTime() - new Date(lastTxnDate).getTime()) / 86_400_000)
    : null

  // Month label positions: record which week-column each month first appears in
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, col) => {
    const m = week[0].date.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ col, label: MONTH_NAMES[m] })
      lastMonth = m
    }
  })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Database</h1>
        <p className="text-stone-400 text-sm mt-0.5">Transaction coverage and upload history</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Customers', value: (totalCustomers ?? 0).toLocaleString() },
          { label: 'Transactions (all time)', value: (totalTransactions ?? 0).toLocaleString() },
          { label: 'Most recent data', value: lastTxnDate ?? '—' },
          {
            label: 'Data freshness',
            value: daysSinceUpdate === null ? '—'
              : daysSinceUpdate === 0 ? 'Today'
              : `${daysSinceUpdate}d ago`,
            accent: daysSinceUpdate !== null && daysSinceUpdate > 3,
          },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <p className="text-stone-400 text-xs mb-1">{label}</p>
            <p className={`text-xl font-bold ${accent ? 'text-orange-400' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Heatmap ── */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-sm">Transactions per day — last 52 weeks</p>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span>Less</span>
            {['bg-stone-800', 'bg-amber-950', 'bg-amber-800', 'bg-amber-600', 'bg-amber-400', 'bg-amber-300'].map(c => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Month labels */}
            <div className="flex mb-1 ml-7">
              {weeks.map((_, col) => {
                const lbl = monthLabels.find(m => m.col === col)
                return (
                  <div key={col} className="w-3.5 flex-shrink-0">
                    {lbl && <span className="text-[10px] text-stone-500 whitespace-nowrap">{lbl.label}</span>}
                  </div>
                )
              })}
            </div>

            {/* Grid: 7 rows (days) × N cols (weeks) */}
            <div className="flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                {DAY_LABELS.map((d, i) => (
                  <div key={d} className="h-3.5 flex items-center">
                    {i % 2 === 1 && <span className="text-[10px] text-stone-600 w-6 text-right">{d}</span>}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {weeks.map((week, col) => (
                <div key={col} className="flex flex-col gap-0.5">
                  {week.map(({ date, iso }) => {
                    const count = countByDate.get(iso) ?? 0
                    const isFuture = date > today
                    return (
                      <div
                        key={iso}
                        title={isFuture ? '' : `${iso}: ${count.toLocaleString()} transaction${count !== 1 ? 's' : ''}`}
                        className={`w-3.5 h-3.5 rounded-sm transition-opacity ${
                          isFuture ? 'opacity-0' : cellColor(count, maxCount)
                        } ${iso === todayIso ? 'ring-1 ring-white/40' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upload log ── */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-3">Recent uploads</p>
        {uploadLog && uploadLog.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 text-xs uppercase">
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-right pb-2 font-medium">Rows</th>
                <th className="text-right pb-2 font-medium">Status</th>
                <th className="text-right pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {uploadLog.map((row, i) => {
                const when = new Date(row.created_at)
                const daysAgo = Math.floor((Date.now() - when.getTime()) / 86_400_000)
                const whenLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`
                return (
                  <tr key={i} className="text-stone-300">
                    <td className="py-2 capitalize">{row.file_type?.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right text-stone-400">{(row.row_count ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.status === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-orange-500/15 text-orange-400'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 text-right text-stone-500 text-xs">{whenLabel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-stone-500 text-sm">No uploads yet.</p>
        )}
      </div>
    </div>
  )
}
