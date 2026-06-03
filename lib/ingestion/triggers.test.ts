import { describe, it, expect } from 'vitest'
import { computeTriggers, type TriggerInput } from './triggers'

const today = new Date('2026-06-01')

const base: TriggerInput = {
  crm_id: 'C1', segment: 'Ghost', days_since_last_visit: 14,
  avg_gap_days: 10, total_visits: 1, points_balance: 0, avg_spend: 8,
  total_visits_all_time: 1, registered_days_ago: 30, last_actions: [],
  new_outlet_visited: false, large_order_days_ago: null, avg_item_quantity: 1,
  first_redemption_this_upload: false,
}

describe('Ghost triggers', () => {
  it('fires GHOST_DAY14 at exactly 14 days', () => {
    const actions = computeTriggers({ ...base, days_since_last_visit: 14 }, today)
    expect(actions.map(a => a.template)).toContain('GHOST_DAY14')
  })
  it('fires GHOST_DAY30_FINAL at 30 days with no prior action', () => {
    const actions = computeTriggers({ ...base, days_since_last_visit: 30, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('GHOST_DAY30_FINAL')
  })
  it('skips GHOST_DAY30_FINAL if action already sent', () => {
    const actions = computeTriggers({ ...base, days_since_last_visit: 30, last_actions: [{ template: 'GHOST_DAY14', days_ago: 16 }] }, today)
    expect(actions.map(a => a.template)).not.toContain('GHOST_DAY30_FINAL')
  })
})

describe('Regular triggers', () => {
  it('fires REGULAR_MONTHLY_SUMMARY on 1st of month', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular' }, new Date('2026-06-01'))
    expect(actions.map(a => a.template)).toContain('REGULAR_MONTHLY_SUMMARY')
  })
  it('fires REGULAR_MILESTONE at visit 10', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular', total_visits_all_time: 10, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('REGULAR_MILESTONE')
  })
})

describe('Dormant triggers', () => {
  it('fires DORMANT_FIRST_NUDGE after 7 days with no prior action', () => {
    const actions = computeTriggers({ ...base, segment: 'Dormant', total_visits: 0, registered_days_ago: 10, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('DORMANT_FIRST_NUDGE')
  })
  it('does not fire DORMANT_FIRST_NUDGE within first 7 days', () => {
    const actions = computeTriggers({ ...base, segment: 'Dormant', total_visits: 0, registered_days_ago: 3, last_actions: [] }, today)
    expect(actions.map(a => a.template)).not.toContain('DORMANT_FIRST_NUDGE')
  })
})
