import { describe, it, expect } from 'vitest'
import { computeRfmScores, type RfmInput } from './rfm'

describe('computeRfmScores', () => {
  const today = new Date('2026-06-03')

  it('gives score 5 for most recent customer', () => {
    const customers: RfmInput[] = [
      { crm_id: 'A', last_visit_date: '2026-06-01', visits_in_last_90_days: 10, avg_spend: 20 },
      { crm_id: 'B', last_visit_date: '2026-01-01', visits_in_last_90_days: 1, avg_spend: 5 },
      { crm_id: 'C', last_visit_date: '2025-06-01', visits_in_last_90_days: 1, avg_spend: 5 },
      { crm_id: 'D', last_visit_date: '2025-01-01', visits_in_last_90_days: 1, avg_spend: 5 },
      { crm_id: 'E', last_visit_date: '2024-06-01', visits_in_last_90_days: 1, avg_spend: 5 },
    ]
    const scores = computeRfmScores(customers, today)
    expect(scores.get('A')!.rfm_r).toBe(5)
    expect(scores.get('E')!.rfm_r).toBe(1)
  })

  it('gives score 5 for highest frequency', () => {
    const customers: RfmInput[] = [
      { crm_id: 'A', last_visit_date: '2026-06-01', visits_in_last_90_days: 20, avg_spend: 10 },
      { crm_id: 'B', last_visit_date: '2026-06-01', visits_in_last_90_days: 5, avg_spend: 10 },
      { crm_id: 'C', last_visit_date: '2026-06-01', visits_in_last_90_days: 3, avg_spend: 10 },
      { crm_id: 'D', last_visit_date: '2026-06-01', visits_in_last_90_days: 2, avg_spend: 10 },
      { crm_id: 'E', last_visit_date: '2026-06-01', visits_in_last_90_days: 1, avg_spend: 10 },
    ]
    const scores = computeRfmScores(customers, today)
    expect(scores.get('A')!.rfm_f).toBe(5)
    expect(scores.get('E')!.rfm_f).toBe(1)
  })

  it('returns entry per customer with scores 1-5', () => {
    const customers: RfmInput[] = Array.from({ length: 5 }, (_, i) => ({
      crm_id: `C${i}`,
      last_visit_date: `2026-0${i + 1}-01`,
      visits_in_last_90_days: i + 1,
      avg_spend: (i + 1) * 10,
    }))
    const scores = computeRfmScores(customers, today)
    expect(scores.size).toBe(5)
    for (const [, s] of scores) {
      expect(s.rfm_r).toBeGreaterThanOrEqual(1)
      expect(s.rfm_r).toBeLessThanOrEqual(5)
    }
  })

  it('handles null last_visit_date gracefully', () => {
    const customers: RfmInput[] = [
      { crm_id: 'A', last_visit_date: null, visits_in_last_90_days: 0, avg_spend: 0 },
    ]
    const scores = computeRfmScores(customers, today)
    expect(scores.get('A')!.rfm_r).toBe(1)
  })
})
