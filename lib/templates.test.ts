import { describe, it, expect } from 'vitest'
import { TEMPLATES, resolveTemplate } from './templates'

describe('resolveTemplate', () => {
  it('replaces {favourite_item} placeholder', () => {
    const msg = resolveTemplate('FLICKERER_WINBACK', { favourite_item: 'Iced Latte' })
    expect(msg).toContain('Iced Latte')
    expect(msg).not.toContain('{favourite_item}')
  })
  it('replaces {points_balance} placeholder', () => {
    const msg = resolveTemplate('FLICKERER_POINTS_NUDGE', { points_balance: '250', favourite_item: 'Mocha' })
    expect(msg).toContain('250')
  })
  it('leaves unreplaced placeholders if value missing', () => {
    const msg = resolveTemplate('REGULAR_MILESTONE', {})
    expect(msg).toContain('{total_visits}')
  })
  it('all required template keys exist', () => {
    const required = ['GHOST_DAY14', 'GHOST_DAY30_FINAL', 'FLICKERER_WINBACK', 'DORMANT_FIRST_NUDGE', 'DORMANT_FINAL_NUDGE']
    for (const key of required) expect(TEMPLATES[key]).toBeDefined()
  })
})
