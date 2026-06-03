import { createClient } from '@/lib/supabase/server'
import { ActionRow } from '@/components/actions/ActionRow'

interface ActionCustomer {
  crm_id: string
  first_name: string | null
  last_name: string | null
  segment: string | null
}

interface ActionRecord {
  id: number
  action_date: string
  action_type: string
  channel: string
  message_template: string
  resolved_message: string
  customers: ActionCustomer | null
}

export default async function ActionsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: rawActions } = await supabase
    .from('journey_log')
    .select(`
      id, action_date, action_type, channel, message_template, resolved_message,
      customers ( crm_id, first_name, last_name, segment )
    `)
    .eq('completed', 0)
    .order('action_date', { ascending: true })

  const actions = (rawActions ?? []) as unknown as ActionRecord[]

  const todayActions = actions.filter(a => a.action_date === today)
  const overdueActions = actions.filter(a => a.action_date < today)

  function customerName(a: ActionRecord) {
    return [a.customers?.first_name, a.customers?.last_name].filter(Boolean).join(' ') || 'Unknown'
  }

  function customerSegment(a: ActionRecord) {
    return a.customers?.segment ?? ''
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Daily Actions</h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {todayActions.length} today · {overdueActions.length} overdue
          </p>
        </div>
      </div>

      {overdueActions.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-orange-400 font-semibold uppercase mb-2">⏰ Overdue from previous days</p>
          {overdueActions.map(a => (
            <ActionRow
              key={a.id}
              id={a.id}
              customerName={customerName(a)}
              segment={customerSegment(a)}
              channel={a.channel}
              template={a.message_template}
              resolvedMessage={a.resolved_message}
              isOverdue={true}
            />
          ))}
        </div>
      )}

      {todayActions.length > 0 ? (
        <div>
          <p className="text-xs text-stone-500 font-semibold uppercase mb-2">Today</p>
          {todayActions.map(a => (
            <ActionRow
              key={a.id}
              id={a.id}
              customerName={customerName(a)}
              segment={customerSegment(a)}
              channel={a.channel}
              template={a.message_template}
              resolvedMessage={a.resolved_message}
              isOverdue={false}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-stone-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-white">All caught up!</p>
          <p className="text-sm mt-1">No pending actions for today.</p>
        </div>
      )}
    </div>
  )
}
