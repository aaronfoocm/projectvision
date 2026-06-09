import { describe, it, expect } from 'vitest'
import { computeTriggers, type TriggerInput } from './triggers'

const today = new Date('2026-06-01')  // 1st of month for Champion test

const base: TriggerInput = {
  crm_id: 'C1', segment: 'Ghost', days_since_last_visit: 65,
  total_visits: 1, points_balance: 0, avg_spend: 8,
  registered_days_ago: 30, last_actions: [],
}

describe('Champion triggers', () => {
  it('fires CHAMPION_THANK_YOU on 1st of month', () => {
    const actions = computeTriggers({ ...base, segment: 'Champion', total_visits: 5, days_since_last_visit: 7 }, today)
    expect(actions.map(a => a.template)).toContain('CHAMPION_THANK_YOU')
  })
  it('skips CHAMPION_THANK_YOU if already sent this month', () => {
    const actions = computeTriggers({ ...base, segment: 'Champion', last_actions: [{ template: 'CHAMPION_THANK_YOU', days_ago: 2 }] }, today)
    expect(actions.map(a => a.template)).not.toContain('CHAMPION_THANK_YOU')
  })
  it('does not fire on non-1st of month', () => {
    const actions = computeTriggers({ ...base, segment: 'Champion' }, new Date('2026-06-15'))
    expect(actions.map(a => a.template)).not.toContain('CHAMPION_THANK_YOU')
  })
})

describe('Regular triggers', () => {
  it('fires REGULAR_MILESTONE at visit 10', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular', total_visits: 10, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('REGULAR_MILESTONE')
  })
  it('fires REGULAR_MILESTONE at visit 25', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular', total_visits: 25, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('REGULAR_MILESTONE')
  })
  it('does not fire REGULAR_MILESTONE at non-milestone visits', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular', total_visits: 8, last_actions: [] }, today)
    expect(actions.map(a => a.template)).not.toContain('REGULAR_MILESTONE')
  })
  it('fires REGULAR_POINTS_NUDGE when points exceed avg spend', () => {
    const actions = computeTriggers({ ...base, segment: 'Regular', points_balance: 10, avg_spend: 8, last_actions: [] }, today)
    expect(actions.map(a => a.template)).toContain('REGULAR_POINTS_NUDGE')
  })
})

describe('NewTrial triggers', () => {
  it('fires NEW_TRIAL_48H within 2 days of first visit', () => {
    const actions = computeTriggers({ ...base, segment: 'NewTrial', total_visits: 1, days_since_last_visit: 2 }, today)
    expect(actions.map(a => a.template)).toContain('NEW_TRIAL_48H')
  })
  it('skips NEW_TRIAL_48H if already sent', () => {
    const actions = computeTriggers({ ...base, segment: 'NewTrial', total_visits: 1, days_since_last_visit: 2, last_actions: [{ template: 'NEW_TRIAL_48H', days_ago: 1 }] }, today)
    expect(actions.map(a => a.template)).not.toContain('NEW_TRIAL_48H')
  })
  it('fires NEW_TRIAL_PROFILE after 7 days of registration', () => {
    const actions = computeTriggers({ ...base, segment: 'NewTrial', registered_days_ago: 7 }, today)
    expect(actions.map(a => a.template)).toContain('NEW_TRIAL_PROFILE')
  })
  it('skips NEW_TRIAL_PROFILE within first 7 days', () => {
    const actions = computeTriggers({ ...base, segment: 'NewTrial', registered_days_ago: 3 }, today)
    expect(actions.map(a => a.template)).not.toContain('NEW_TRIAL_PROFILE')
  })
})

describe('AtRisk triggers', () => {
  it('fires AT_RISK_WINBACK on first contact', () => {
    const actions = computeTriggers({ ...base, segment: 'AtRisk', total_visits: 4, days_since_last_visit: 35, points_balance: 50 }, today)
    expect(actions.map(a => a.template)).toContain('AT_RISK_WINBACK')
  })
  it('fires AT_RISK_WEEKLY after 7+ days with no response to winback', () => {
    const actions = computeTriggers({
      ...base, segment: 'AtRisk', total_visits: 4, days_since_last_visit: 42, points_balance: 50,
      last_actions: [{ template: 'AT_RISK_WINBACK', days_ago: 8 }],
    }, today)
    expect(actions.map(a => a.template)).toContain('AT_RISK_WEEKLY')
  })
  it('does not send AT_RISK_WEEKLY before 7 days', () => {
    const actions = computeTriggers({
      ...base, segment: 'AtRisk', total_visits: 4, days_since_last_visit: 38, points_balance: 50,
      last_actions: [{ template: 'AT_RISK_WINBACK', days_ago: 3 }],
    }, today)
    expect(actions.map(a => a.template)).not.toContain('AT_RISK_WEEKLY')
  })
})

describe('LapsedLoyal triggers', () => {
  it('fires LAPSED_LOYAL_COMEBACK_1 on first contact', () => {
    const actions = computeTriggers({ ...base, segment: 'LapsedLoyal', total_visits: 8, days_since_last_visit: 70 }, today)
    expect(actions.map(a => a.template)).toContain('LAPSED_LOYAL_COMEBACK_1')
  })
  it('fires LAPSED_LOYAL_COMEBACK_2 after 7+ days with no response', () => {
    const actions = computeTriggers({
      ...base, segment: 'LapsedLoyal', total_visits: 8, days_since_last_visit: 77,
      last_actions: [{ template: 'LAPSED_LOYAL_COMEBACK_1', days_ago: 7 }],
    }, today)
    expect(actions.map(a => a.template)).toContain('LAPSED_LOYAL_COMEBACK_2')
  })
  it('does not fire after both contacts sent', () => {
    const actions = computeTriggers({
      ...base, segment: 'LapsedLoyal',
      last_actions: [
        { template: 'LAPSED_LOYAL_COMEBACK_1', days_ago: 14 },
        { template: 'LAPSED_LOYAL_COMEBACK_2', days_ago: 7 },
      ],
    }, today)
    expect(actions.length).toBe(0)
  })
})

describe('Dormant triggers', () => {
  it('fires DORMANT_POINTS_EXPIRY for 200+ points', () => {
    const actions = computeTriggers({ ...base, segment: 'Dormant', total_visits: 3, days_since_last_visit: 70, points_balance: 250 }, today)
    expect(actions.map(a => a.template)).toContain('DORMANT_POINTS_EXPIRY')
  })
  it('does not fire DORMANT_POINTS_EXPIRY for <200 points', () => {
    const actions = computeTriggers({ ...base, segment: 'Dormant', total_visits: 3, days_since_last_visit: 70, points_balance: 100 }, today)
    expect(actions.map(a => a.template)).not.toContain('DORMANT_POINTS_EXPIRY')
  })
  it('does not fire twice', () => {
    const actions = computeTriggers({
      ...base, segment: 'Dormant', points_balance: 250,
      last_actions: [{ template: 'DORMANT_POINTS_EXPIRY', days_ago: 5 }],
    }, today)
    expect(actions.map(a => a.template)).not.toContain('DORMANT_POINTS_EXPIRY')
  })
})

describe('Ghost triggers', () => {
  it('fires GHOST_SINGLE_PUSH once on first contact', () => {
    const actions = computeTriggers({ ...base, segment: 'Ghost', total_visits: 1, days_since_last_visit: 65 }, today)
    expect(actions.map(a => a.template)).toContain('GHOST_SINGLE_PUSH')
  })
  it('uses push channel for Ghost', () => {
    const actions = computeTriggers({ ...base, segment: 'Ghost', total_visits: 1 }, today)
    const push = actions.find(a => a.template === 'GHOST_SINGLE_PUSH')
    expect(push?.channel).toBe('push')
  })
  it('does not fire GHOST_SINGLE_PUSH if already sent', () => {
    const actions = computeTriggers({
      ...base, segment: 'Ghost',
      last_actions: [{ template: 'GHOST_SINGLE_PUSH', days_ago: 10 }],
    }, today)
    expect(actions.map(a => a.template)).not.toContain('GHOST_SINGLE_PUSH')
  })
})

describe('NeverTransacted triggers', () => {
  it('fires NEVER_TRANSACTED_ACTIVATION after 7 days', () => {
    const actions = computeTriggers({ ...base, segment: 'NeverTransacted', total_visits: 0, days_since_last_visit: 9999, registered_days_ago: 10 }, today)
    expect(actions.map(a => a.template)).toContain('NEVER_TRANSACTED_ACTIVATION')
  })
  it('skips within first 7 days', () => {
    const actions = computeTriggers({ ...base, segment: 'NeverTransacted', total_visits: 0, registered_days_ago: 3 }, today)
    expect(actions.map(a => a.template)).not.toContain('NEVER_TRANSACTED_ACTIVATION')
  })
  it('uses push channel for NeverTransacted', () => {
    const actions = computeTriggers({ ...base, segment: 'NeverTransacted', total_visits: 0, registered_days_ago: 14 }, today)
    const push = actions.find(a => a.template === 'NEVER_TRANSACTED_ACTIVATION')
    expect(push?.channel).toBe('push')
  })
})
