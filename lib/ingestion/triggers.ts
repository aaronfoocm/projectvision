import type { Segment } from '@/lib/types'

export interface LastAction { template: string; days_ago: number }

export interface TriggerInput {
  crm_id: string
  segment: Segment
  days_since_last_visit: number
  avg_gap_days: number
  total_visits: number
  points_balance: number
  avg_spend: number
  total_visits_all_time: number
  registered_days_ago: number
  last_actions: LastAction[]
  new_outlet_visited: boolean
  large_order_days_ago: number | null
  avg_item_quantity: number
  first_redemption_this_upload: boolean
}

export interface TriggeredAction {
  template: string
  channel: 'whatsapp' | 'in_store'
  action_type: string
}

function hasAction(last: LastAction[], template: string): boolean {
  return last.some(a => a.template === template)
}

function daysSinceAction(last: LastAction[], template: string): number | null {
  return last.find(a => a.template === template)?.days_ago ?? null
}

function sentThisMonth(last: LastAction[], template: string): boolean {
  const d = daysSinceAction(last, template)
  return d !== null && d <= 31
}

function sentThisQuarter(last: LastAction[], template: string): boolean {
  const d = daysSinceAction(last, template)
  return d !== null && d <= 92
}

function isFirstOfMonth(date: Date): boolean {
  return date.getDate() === 1
}

export function computeTriggers(c: TriggerInput, today: Date = new Date()): TriggeredAction[] {
  const actions: TriggeredAction[] = []

  if (c.segment === 'Ghost') {
    if (c.days_since_last_visit === 14) {
      actions.push({ template: 'GHOST_DAY14', channel: 'whatsapp', action_type: 'whatsapp' })
    } else if (c.days_since_last_visit === 30 && !hasAction(c.last_actions, 'GHOST_DAY14') && !hasAction(c.last_actions, 'GHOST_DAY30_FINAL')) {
      actions.push({ template: 'GHOST_DAY30_FINAL', channel: 'whatsapp', action_type: 'whatsapp' })
    }
  }

  if (c.segment === 'Flickerer') {
    if (c.days_since_last_visit > c.avg_gap_days * 1.5 && !hasAction(c.last_actions, 'FLICKERER_WINBACK')) {
      actions.push({ template: 'FLICKERER_WINBACK', channel: 'whatsapp', action_type: 'whatsapp' })
    } else {
      const wb = daysSinceAction(c.last_actions, 'FLICKERER_WINBACK')
      if (wb !== null && wb > 5 && !hasAction(c.last_actions, 'FLICKERER_POINTS_NUDGE')) {
        actions.push({ template: 'FLICKERER_POINTS_NUDGE', channel: 'whatsapp', action_type: 'points_nudge' })
      }
    }
  }

  if (c.segment === 'Regular') {
    if (isFirstOfMonth(today)) actions.push({ template: 'REGULAR_MONTHLY_SUMMARY', channel: 'whatsapp', action_type: 'whatsapp' })
    if ([10, 25, 50].includes(c.total_visits_all_time) && !hasAction(c.last_actions, 'REGULAR_MILESTONE')) {
      actions.push({ template: 'REGULAR_MILESTONE', channel: 'in_store', action_type: 'milestone' })
    }
    if (c.avg_spend > 0 && c.points_balance / c.avg_spend >= 1 && !sentThisMonth(c.last_actions, 'REGULAR_POINTS_NUDGE')) {
      actions.push({ template: 'REGULAR_POINTS_NUDGE', channel: 'whatsapp', action_type: 'points_nudge' })
    }
  }

  if (c.segment === 'Explorer') {
    if (c.new_outlet_visited) actions.push({ template: 'EXPLORER_NEW_OUTLET', channel: 'whatsapp', action_type: 'whatsapp' })
    if (isFirstOfMonth(today)) actions.push({ template: 'EXPLORER_MONTHLY_NEWS', channel: 'whatsapp', action_type: 'whatsapp' })
    if (c.total_visits_all_time >= 5 && !hasAction(c.last_actions, 'EXPLORER_REFERRAL')) {
      actions.push({ template: 'EXPLORER_REFERRAL', channel: 'whatsapp', action_type: 'referral' })
    }
  }

  if (c.segment === 'Hoarder') {
    if (isFirstOfMonth(today)) actions.push({ template: 'HOARDER_POINTS_STATEMENT', channel: 'whatsapp', action_type: 'points_nudge' })
    if (c.points_balance > 0 && c.days_since_last_visit >= 335 && !sentThisQuarter(c.last_actions, 'HOARDER_EXPIRY_NUDGE')) {
      actions.push({ template: 'HOARDER_EXPIRY_NUDGE', channel: 'whatsapp', action_type: 'points_nudge' })
    }
    if (c.first_redemption_this_upload) actions.push({ template: 'HOARDER_FIRST_REDEMPTION', channel: 'whatsapp', action_type: 'whatsapp' })
  }

  if (c.segment === 'GroupBuyer') {
    if (c.large_order_days_ago !== null && c.large_order_days_ago <= 2 && !hasAction(c.last_actions, 'GROUP_POST_ORDER')) {
      actions.push({ template: 'GROUP_POST_ORDER', channel: 'whatsapp', action_type: 'whatsapp' })
    }
    if (c.avg_item_quantity >= 3 && !hasAction(c.last_actions, 'GROUP_PREORDER_NUDGE')) {
      actions.push({ template: 'GROUP_PREORDER_NUDGE', channel: 'whatsapp', action_type: 'whatsapp' })
    }
    if (isFirstOfMonth(today)) actions.push({ template: 'GROUP_MONTHLY_OCCASION', channel: 'whatsapp', action_type: 'whatsapp' })
  }

  if (c.segment === 'Dormant') {
    if (c.registered_days_ago >= 7 && !hasAction(c.last_actions, 'DORMANT_FIRST_NUDGE') && !hasAction(c.last_actions, 'DORMANT_FINAL_NUDGE')) {
      actions.push({ template: 'DORMANT_FIRST_NUDGE', channel: 'whatsapp', action_type: 'whatsapp' })
    } else {
      const fn = daysSinceAction(c.last_actions, 'DORMANT_FIRST_NUDGE')
      if (fn !== null && fn >= 23 && !hasAction(c.last_actions, 'DORMANT_FINAL_NUDGE')) {
        actions.push({ template: 'DORMANT_FINAL_NUDGE', channel: 'whatsapp', action_type: 'whatsapp' })
      }
    }
  }

  return actions
}
