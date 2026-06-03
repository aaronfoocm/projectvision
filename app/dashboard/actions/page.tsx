import { createClient } from '@/lib/supabase/server'
import { ActionBatch } from '@/components/actions/ActionBatch'

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

  const { data: rawActions } = await supabase
    .from('journey_log')
    .select(`
      id, action_date, action_type, channel, message_template, resolved_message,
      customers ( crm_id, first_name, last_name, segment )
    `)
    .eq('completed', 0)
    .order('action_date', { ascending: true })

  const actions = (rawActions ?? []) as unknown as ActionRecord[]

  // Group by message_template
  const batchMap = new Map<string, ActionRecord[]>()
  for (const a of actions) {
    const arr = batchMap.get(a.message_template) ?? []
    arr.push(a)
    batchMap.set(a.message_template, arr)
  }

  const batches = [...batchMap.entries()]
    .map(([template, records]) => ({
      template,
      actionType: records[0].action_type,
      channel: records[0].channel,
      sampleMessage: records[0].resolved_message,
      actions: records,
    }))
    .sort((a, b) => b.actions.length - a.actions.length)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Daily Actions</h1>
        <p className="text-stone-400 text-sm mt-0.5">
          {actions.length} pending · {batches.length} batch{batches.length !== 1 ? 'es' : ''} · Download each batch to send via WhatsApp
        </p>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-white">All caught up!</p>
          <p className="text-sm mt-1">No pending actions.</p>
        </div>
      ) : (
        <div>
          {batches.map(b => (
            <ActionBatch
              key={b.template}
              template={b.template}
              actionType={b.actionType}
              channel={b.channel}
              sampleMessage={b.sampleMessage}
              actions={b.actions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
