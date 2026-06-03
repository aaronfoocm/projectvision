'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

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
