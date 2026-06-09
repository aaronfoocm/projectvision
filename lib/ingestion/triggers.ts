import type { Segment } from '@/lib/types'

export interface LastAction { template: string; days_ago: number }

export interface TriggerInput {
  crm_id: string
  segment: Segment
  days_since_last_visit: number
  total_visits: number
  points_balance: number
  avg_spend: number
  registered_days_ago: number
  last_actions: LastAction[]
}

export interface TriggeredAction {
  template: string
  channel: 'whatsapp' | 'push' | 'in_store'
  action_type: string
}

function hasAction(last: LastAction[], template: string): boolean {
  return last.some(a => a.template === template)
}

function daysSinceAction(last: LastAction[], template: string): number | null {
  return last.find(a => a.template === template)?.days_ago ?? null
}

function isFirstOfMonth(date: Date): boolean {
  return date.getDate() === 1
}

export function computeTriggers(c: TriggerInput, today: Date = new Date()): TriggeredAction[] {
  const actions: TriggeredAction[] = []

  if (c.segment === 'Champion') {
    if (isFirstOfMonth(today) && !hasAction(c.last_actions, 'CHAMPION_THANK_YOU')) {
      actions.push({ template: 'CHAMPION_THANK_YOU', channel: 'whatsapp', action_type: 'whatsapp' })
    }
  }

  if (c.segment === 'Regular') {
    if ([10, 25, 50].includes(c.total_visits) && !hasAction(c.last_actions, 'REGULAR_MILESTONE')) {
      actions.push({ template: 'REGULAR_MILESTONE', channel: 'in_store', action_type: 'milestone' })
    }
    if (c.avg_spend > 0 && c.points_balance / c.avg_spend >= 1 && !hasAction(c.last_actions, 'REGULAR_POINTS_NUDGE')) {
      actions.push({ template: 'REGULAR_POINTS_NUDGE', channel: 'whatsapp', action_type: 'points_nudge' })
    }
  }

  if (c.segment === 'NewTrial') {
    if (c.total_visits === 1 && c.days_since_last_visit <= 2 && !hasAction(c.last_actions, 'NEW_TRIAL_48H')) {
      actions.push({ template: 'NEW_TRIAL_48H', channel: 'whatsapp', action_type: 'whatsapp' })
    }
    if (c.registered_days_ago >= 7 && !hasAction(c.last_actions, 'NEW_TRIAL_PROFILE')) {
      actions.push({ template: 'NEW_TRIAL_PROFILE', channel: 'whatsapp', action_type: 'whatsapp' })
    }
  }

  if (c.segment === 'AtRisk') {
    if (!hasAction(c.last_actions, 'AT_RISK_WINBACK')) {
      actions.push({ template: 'AT_RISK_WINBACK', channel: 'whatsapp', action_type: 'points_nudge' })
    } else {
      const wb = daysSinceAction(c.last_actions, 'AT_RISK_WINBACK')
      if (wb !== null && wb >= 7 && !hasAction(c.last_actions, 'AT_RISK_WEEKLY')) {
        actions.push({ template: 'AT_RISK_WEEKLY', channel: 'whatsapp', action_type: 'whatsapp' })
      }
    }
  }

  if (c.segment === 'LapsedLoyal') {
    if (!hasAction(c.last_actions, 'LAPSED_LOYAL_COMEBACK_1')) {
      actions.push({ template: 'LAPSED_LOYAL_COMEBACK_1', channel: 'whatsapp', action_type: 'whatsapp' })
    } else {
      const d1 = daysSinceAction(c.last_actions, 'LAPSED_LOYAL_COMEBACK_1')
      if (d1 !== null && d1 >= 7 && !hasAction(c.last_actions, 'LAPSED_LOYAL_COMEBACK_2')) {
        actions.push({ template: 'LAPSED_LOYAL_COMEBACK_2', channel: 'whatsapp', action_type: 'whatsapp' })
      }
    }
  }

  if (c.segment === 'Dormant') {
    if (c.points_balance >= 200 && !hasAction(c.last_actions, 'DORMANT_POINTS_EXPIRY')) {
      actions.push({ template: 'DORMANT_POINTS_EXPIRY', channel: 'whatsapp', action_type: 'points_nudge' })
    }
  }

  if (c.segment === 'Ghost') {
    if (!hasAction(c.last_actions, 'GHOST_SINGLE_PUSH')) {
      actions.push({ template: 'GHOST_SINGLE_PUSH', channel: 'push', action_type: 'push' })
    }
  }

  if (c.segment === 'NeverTransacted') {
    if (c.registered_days_ago >= 7 && !hasAction(c.last_actions, 'NEVER_TRANSACTED_ACTIVATION')) {
      actions.push({ template: 'NEVER_TRANSACTED_ACTIVATION', channel: 'push', action_type: 'push' })
    }
  }

  return actions
}
