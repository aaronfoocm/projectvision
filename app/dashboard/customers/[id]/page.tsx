import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DrinkDNA } from '@/components/customers/DrinkDNA'
import { ArrowLeft, MapPin, Phone, Mail } from 'lucide-react'
import { SEGMENT_META } from '@/lib/segment-meta'

const OUTCOME_COLORS: Record<string, string> = {
  redeemed:    'text-green-400',
  visited:     'text-blue-400',
  no_response: 'text-stone-500',
}

function formatDateTime(iso: string | null) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date, time }
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: drink }, { data: journeyLog }, { data: recentTxns }] = await Promise.all([
    supabase.from('customers').select('*').eq('crm_id', id).single(),
    supabase.from('drink_profiles').select('*').eq('customer_id', id).maybeSingle(),
    supabase
      .from('journey_log')
      .select('*')
      .eq('customer_id', id)
      .order('action_date', { ascending: false })
      .limit(20),
    supabase
      .from('transactions')
      .select('koppiku_ref, transaction_date, outlet_code, net_sales, total_amount')
      .eq('customer_id', id)
      .order('transaction_date', { ascending: false })
      .limit(5),
  ])

  if (!customer) notFound()

  // Fetch bill items for those 5 transactions
  const txnRefs = (recentTxns ?? []).map(t => t.koppiku_ref)
  const { data: billItems } = txnRefs.length
    ? await supabase
        .from('bill_items')
        .select('transaction_id, item_name, item_qty, point_awarded, is_modifier')
        .in('transaction_id', txnRefs)
        .eq('is_modifier', false)
    : { data: [] }

  const itemsByTxn = new Map<string, typeof billItems>()
  for (const item of billItems ?? []) {
    const arr = itemsByTxn.get(item.transaction_id) ?? []
    arr.push(item)
    itemsByTxn.set(item.transaction_id, arr)
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.crm_id
  const meta = customer.segment
    ? (SEGMENT_META[customer.segment as keyof typeof SEGMENT_META] ?? SEGMENT_META.Dormant)
    : SEGMENT_META.Dormant

  const nextAction   = (journeyLog ?? []).find(j => j.completed === 0)
  const completedLog = (journeyLog ?? []).filter(j => j.completed === 1)

  return (
    <div className="p-8 max-w-2xl">
      <a href="/dashboard/customers" className="flex items-center gap-1.5 text-stone-400 hover:text-white text-sm mb-6 transition-colors cursor-pointer">
        <ArrowLeft size={14} /> Back to customers
      </a>

      {/* ── Customer header card ───────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-stone-700 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              {name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">{name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {customer.email && (
                  <span className="text-xs text-stone-500 flex items-center gap-1">
                    <Mail size={11} />{customer.email}
                  </span>
                )}
                {customer.mobile && (
                  <span className="text-xs text-stone-500 flex items-center gap-1">
                    <Phone size={11} />+{customer.mobile}
                  </span>
                )}
                {customer.current_loc_code && (
                  <span className="text-xs text-stone-500 flex items-center gap-1">
                    <MapPin size={11} />{customer.current_loc_code}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {customer.segment && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.badge}`}>
                {meta.emoji} {customer.segment}
              </span>
            )}
            {customer.rfm_r != null && (
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                RFM{' '}
                <span className="text-green-400 font-semibold">{customer.rfm_r}</span>
                <span className="text-stone-600">-</span>
                <span className="text-blue-400 font-semibold">{customer.rfm_f}</span>
                <span className="text-stone-600">-</span>
                <span className="text-amber-400 font-semibold">{customer.rfm_m}</span>
              </span>
            )}
          </div>
        </div>

        {drink && (
          <div className="mb-4">
            <p className="text-xs text-stone-500 uppercase font-semibold mb-2">Drink DNA</p>
            <DrinkDNA
              preferred_temp={drink.preferred_temp}
              preferred_time_slot={drink.preferred_time_slot}
              preferred_milk={drink.preferred_milk}
              favourite_drink={drink.favourite_drink}
              preferred_size={drink.preferred_size}
            />
            {drink.top_modifier_1 && (
              <p className="text-xs text-stone-500 mt-2">
                Usual add-ons: {[drink.top_modifier_1, drink.top_modifier_2].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Visits',   value: customer.total_visits ?? 0 },
            { label: 'Avg gap',  value: customer.avg_gap_days ? `${Math.round(customer.avg_gap_days)}d` : '-' },
            { label: 'Points',   value: (customer.points_balance ?? 0).toLocaleString() },
            { label: 'Outlets',  value: customer.outlet_count ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-stone-800 rounded-lg p-3 text-center">
              <div className="text-white font-bold text-lg tabular-nums">{value}</div>
              <div className="text-stone-500 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Last 5 transactions ────────────────────────────────────────────── */}
      {(recentTxns ?? []).length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-stone-800">
            <p className="text-xs text-stone-500 uppercase font-semibold">Last 5 transactions</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-600 uppercase tracking-wide border-b border-stone-800 bg-stone-950/30">
                <th className="text-left px-5 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Time</th>
                <th className="text-left px-4 py-2.5 font-medium">Outlet</th>
                <th className="text-left px-4 py-2.5 font-medium">Items</th>
                <th className="text-right px-5 py-2.5 font-medium">Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {(recentTxns ?? []).map(txn => {
                const { date, time } = formatDateTime(txn.transaction_date)
                const items = itemsByTxn.get(txn.koppiku_ref) ?? []
                return (
                  <tr key={txn.koppiku_ref} className="hover:bg-stone-800/30 transition-colors duration-100">
                    <td className="px-5 py-3 text-stone-300 text-xs whitespace-nowrap">{date}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap tabular-nums">{time}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs font-mono">{txn.outlet_code ?? '-'}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs max-w-[200px]">
                      {items.length > 0
                        ? items.map(i => `${i.item_qty > 1 ? `${i.item_qty}x ` : ''}${i.item_name}`).join(', ')
                        : <span className="text-stone-600">-</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right text-amber-400 text-xs font-semibold tabular-nums font-mono">
                      RM {txn.net_sales.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Next action ────────────────────────────────────────────────────── */}
      {nextAction && (
        <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4 mb-4">
          <p className="text-xs text-green-400 font-semibold uppercase mb-2">Next recommended action</p>
          <p className="text-sm text-stone-300 font-medium">{nextAction.message_template} · {nextAction.channel}</p>
          {nextAction.resolved_message && (
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{nextAction.resolved_message}</p>
          )}
        </div>
      )}

      {/* ── Journey log ────────────────────────────────────────────────────── */}
      {completedLog.length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <p className="text-xs text-stone-500 uppercase font-semibold mb-4">Journey log</p>
          <div className="space-y-3">
            {completedLog.map(entry => (
              <div key={entry.id} className="flex gap-4 text-sm">
                <span className="text-stone-600 text-xs whitespace-nowrap pt-0.5">{entry.action_date}</span>
                <div>
                  <span className="text-white font-medium">{entry.message_template}</span>
                  <span className="text-stone-500"> · {entry.channel}</span>
                  {entry.outcome && (
                    <span className={`ml-2 text-xs font-semibold ${OUTCOME_COLORS[entry.outcome] ?? 'text-stone-500'}`}>
                      {entry.outcome}
                    </span>
                  )}
                  {entry.resolved_message && (
                    <p className="text-stone-500 text-xs mt-0.5 line-clamp-2">{entry.resolved_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completedLog.length === 0 && !nextAction && (
        <div className="text-center py-8 text-stone-500">
          <p className="text-sm">No actions yet for this customer.</p>
        </div>
      )}
    </div>
  )
}
