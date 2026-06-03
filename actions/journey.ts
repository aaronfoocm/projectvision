'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function getActionBatchDownload(
  template: string,
): Promise<{ phone: string; name: string; message: string }[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('journey_log')
    .select('resolved_message, customers ( mobile, first_name, last_name )')
    .eq('message_template', template)
    .eq('completed', 0)

  return (data ?? []).map(row => {
    const c = row.customers as unknown as { mobile: string | null; first_name: string | null; last_name: string | null } | null
    return {
      phone: c?.mobile ?? '',
      name: [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Unknown',
      message: row.resolved_message,
    }
  })
}

export async function markActionDone(
  journeyId: number,
  outcome: 'redeemed' | 'visited' | 'no_response',
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('journey_log')
    .update({ completed: 1, outcome })
    .eq('id', journeyId)
  revalidatePath('/dashboard/actions')
  revalidatePath('/dashboard')
}
