import { describe, it, expect } from 'vitest'
import { assignSegment, type SegmentInput } from './segments'

const base: SegmentInput = {
  crm_id: 'X',
  total_visits: 0,
  last_visit_days_ago: 9999,
}

describe('assignSegment', () => {
  it('assigns NeverTransacted for zero visits', () => {
    expect(assignSegment({ ...base, total_visits: 0 })).toBe('NeverTransacted')
  })

  it('assigns Champion for 4+ visits within 14 days', () => {
    expect(assignSegment({ ...base, total_visits: 4, last_visit_days_ago: 10 })).toBe('Champion')
  })
  it('assigns Champion for exactly 14 days and 4+ visits', () => {
    expect(assignSegment({ ...base, total_visits: 5, last_visit_days_ago: 14 })).toBe('Champion')
  })
  it('does not assign Champion for 3 visits even within 14 days', () => {
    expect(assignSegment({ ...base, total_visits: 3, last_visit_days_ago: 10 })).toBe('Regular')
  })

  it('assigns Regular for 3+ visits within 30 days (but >14 days)', () => {
    expect(assignSegment({ ...base, total_visits: 3, last_visit_days_ago: 20 })).toBe('Regular')
  })
  it('assigns Regular for 4+ visits at 15–30 days (not Champion)', () => {
    expect(assignSegment({ ...base, total_visits: 4, last_visit_days_ago: 20 })).toBe('Regular')
  })

  it('assigns NewTrial for <3 visits within 30 days', () => {
    expect(assignSegment({ ...base, total_visits: 1, last_visit_days_ago: 5 })).toBe('NewTrial')
  })
  it('assigns NewTrial for 2 visits within 30 days', () => {
    expect(assignSegment({ ...base, total_visits: 2, last_visit_days_ago: 25 })).toBe('NewTrial')
  })

  it('assigns AtRisk for 3+ visits at 31–60 days', () => {
    expect(assignSegment({ ...base, total_visits: 3, last_visit_days_ago: 45 })).toBe('AtRisk')
  })
  it('assigns AtRisk at exactly 31 days with 3+ visits', () => {
    expect(assignSegment({ ...base, total_visits: 5, last_visit_days_ago: 31 })).toBe('AtRisk')
  })
  it('does not assign AtRisk for <3 visits at 31–60 days (falls to Ghost)', () => {
    expect(assignSegment({ ...base, total_visits: 2, last_visit_days_ago: 45 })).toBe('Ghost')
  })

  it('assigns LapsedLoyal for 6+ visits at 60+ days', () => {
    expect(assignSegment({ ...base, total_visits: 6, last_visit_days_ago: 90 })).toBe('LapsedLoyal')
  })
  it('assigns LapsedLoyal for many visits at 60+ days', () => {
    expect(assignSegment({ ...base, total_visits: 15, last_visit_days_ago: 75 })).toBe('LapsedLoyal')
  })

  it('assigns Dormant for 2–5 visits at 60+ days', () => {
    expect(assignSegment({ ...base, total_visits: 4, last_visit_days_ago: 65 })).toBe('Dormant')
  })
  it('assigns Dormant for exactly 2 visits at 61 days', () => {
    expect(assignSegment({ ...base, total_visits: 2, last_visit_days_ago: 61 })).toBe('Dormant')
  })

  it('assigns Ghost for 1 visit at 60+ days', () => {
    expect(assignSegment({ ...base, total_visits: 1, last_visit_days_ago: 90 })).toBe('Ghost')
  })
  it('assigns Ghost for 1–2 visits at 31–60 days (early lapser fallback)', () => {
    expect(assignSegment({ ...base, total_visits: 1, last_visit_days_ago: 45 })).toBe('Ghost')
  })
})
