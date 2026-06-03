import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DrinkDNA } from '@/components/customers/DrinkDNA'
import { ArrowLeft, MapPin, Phone, Mail } from 'lucide-react'

const SEGMENT_COLORS: Record<string, string> = {
  Regular:    'bg-green-500/15 text-green-400 border-green-500/30',
  Explorer:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Flickerer:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Ghost:      'bg-red-500/15 text-red-400 border-red-500/30',
  Hoarder:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  GroupBuyer: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Dormant:    'bg-stone-500/15 text-stone-400 border-stone-500/30',
}

const OUTCOME_COLORS: Record<string, string> = {
  redeemed: 'text-green-400',
  visited: 'text-blue-400',
  no_response: 'text-stone-500',
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: drink }, { data: journeyLog }] = await Promise.all([
    supabase.from('customers').select('*').eq('crm_id', id).single(),
    supabase.from('drink_profiles').select('*').eq('customer_id', id).maybeSingle(),
    supabase
      .from('journey_log')
      .select('*')
      .eq('customer_id', id)
      .order('action_date', { ascending: false })
      .limit(20),
  ])

  if (!customer) notFound()

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.crm_id
  const segColor = customer.segment
    ? (SEGMENT_COLORS[customer.segment] ?? SEGMENT_COLORS.Dormant)
    : SEGMENT_COLORS.Dormant

  const nextAction = (journeyLog ?? []).find(j => j.completed === 0)
  const completedLog = (journeyLog ?? []).filter(j => j.completed === 1)

  return (
    <div className="p-8 max-w-2xl">
      <a href="/dashboard/customers" className="flex items-center gap-1.5 text-stone-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to customers
      </a>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 mb-4">
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
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${segColor}`}>
                {customer.segment}
              </span>
            )}
            {customer.rfm_r != null && (
              <span className="text-xs text-stone-500">
                RFM <span className="text-amber-400 font-semibold">{customer.rfm_r}-{customer.rfm_f}-{customer.rfm_m}</span>
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
            { label: 'Visits', value: customer.total_visits ?? 0 },
            { label: 'Avg gap', value: customer.avg_gap_days ? `${Math.round(customer.avg_gap_days)}d` : '—' },
            { label: 'Points', value: (customer.points_balance ?? 0).toLocaleString() },
            { label: 'Outlets', value: customer.outlet_count ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-stone-800 rounded-lg p-3 text-center">
              <div className="text-white font-bold text-lg">{value}</div>
              <div className="text-stone-500 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {nextAction && (
        <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4 mb-4">
          <p className="text-xs text-green-400 font-semibold uppercase mb-2">Next recommended action</p>
          <p className="text-sm text-stone-300 font-medium">{nextAction.message_template} · {nextAction.channel}</p>
          {nextAction.resolved_message && (
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{nextAction.resolved_message}</p>
          )}
        </div>
      )}

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
