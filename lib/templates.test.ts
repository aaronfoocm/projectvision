import { describe, it, expect } from 'vitest'
import { TEMPLATES, resolveTemplate } from './templates'

describe('resolveTemplate', () => {
  it('replaces {favourite_item} placeholder', () => {
    const msg = resolveTemplate('GHOST_SINGLE_PUSH', { favourite_item: 'Iced Latte' })
    expect(msg).toContain('Iced Latte')
    expect(msg).not.toContain('{favourite_item}')
  })
  it('replaces {points_balance} placeholder', () => {
    const msg = resolveTemplate('AT_RISK_WINBACK', { first_name: 'Aaron', points_balance: '250', favourite_item: 'Mocha' })
    expect(msg).toContain('250')
  })
  it('leaves unreplaced placeholders if value missing', () => {
    const msg = resolveTemplate('REGULAR_MILESTONE', {})
    expect(msg).toContain('{total_visits}')
  })
  it('all required template keys exist', () => {
    const required = [
      'CHAMPION_THANK_YOU', 'CHAMPION_EARLY_ACCESS',
      'REGULAR_MILESTONE', 'REGULAR_STREAK', 'REGULAR_POINTS_NUDGE',
      'NEW_TRIAL_48H', 'NEW_TRIAL_PROFILE',
      'AT_RISK_WINBACK', 'AT_RISK_WEEKLY',
      'LAPSED_LOYAL_COMEBACK_1', 'LAPSED_LOYAL_COMEBACK_2',
      'DORMANT_POINTS_EXPIRY',
      'GHOST_SINGLE_PUSH',
      'NEVER_TRANSACTED_ACTIVATION',
    ]
    for (const key of required) expect(TEMPLATES[key]).toBeDefined()
  })
})
