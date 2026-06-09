import { describe, it, expect } from 'vitest'
import { computeRfmScores, type RfmInput } from './rfm'

const today = new Date('2026-06-09')

function customer(crm_id: string, daysAgo: number, visits60: number, avgSpend = 10): RfmInput {
  const d = new Date(today.getTime() - daysAgo * 86_400_000)
  return { crm_id, last_visit_date: d.toISOString().slice(0, 10), visits_in_last_60_days: visits60, avg_spend: avgSpend }
}

describe('computeRfmScores — R (fixed thresholds)', () => {
  it('R5 for ≤7 days ago', () => {
    const scores = computeRfmScores([customer('A', 3, 1)])
    expect(scores.get('A')!.rfm_r).toBe(5)
  })
  it('R5 for exactly 7 days ago', () => {
    const scores = computeRfmScores([customer('A', 7, 1)])
    expect(scores.get('A')!.rfm_r).toBe(5)
  })
  it('R4 for 8 days ago', () => {
    const scores = computeRfmScores([customer('A', 8, 1)])
    expect(scores.get('A')!.rfm_r).toBe(4)
  })
  it('R4 for 14 days ago', () => {
    const scores = computeRfmScores([customer('A', 14, 1)])
    expect(scores.get('A')!.rfm_r).toBe(4)
  })
  it('R3 for 15 days ago', () => {
    const scores = computeRfmScores([customer('A', 15, 1)])
    expect(scores.get('A')!.rfm_r).toBe(3)
  })
  it('R3 for 30 days ago', () => {
    const scores = computeRfmScores([customer('A', 30, 1)])
    expect(scores.get('A')!.rfm_r).toBe(3)
  })
  it('R2 for 31 days ago', () => {
    const scores = computeRfmScores([customer('A', 31, 1)])
    expect(scores.get('A')!.rfm_r).toBe(2)
  })
  it('R2 for 60 days ago', () => {
    const scores = computeRfmScores([customer('A', 60, 1)])
    expect(scores.get('A')!.rfm_r).toBe(2)
  })
  it('R1 for 61+ days ago', () => {
    const scores = computeRfmScores([customer('A', 90, 1)])
    expect(scores.get('A')!.rfm_r).toBe(1)
  })
  it('R1 for null last_visit_date', () => {
    const scores = computeRfmScores([{ crm_id: 'A', last_visit_date: null, visits_in_last_60_days: 0, avg_spend: 0 }])
    expect(scores.get('A')!.rfm_r).toBe(1)
  })
})

describe('computeRfmScores — F (fixed thresholds, last 60 days)', () => {
  it('F1 for 0 visits', () => {
    const scores = computeRfmScores([customer('A', 90, 0)])
    expect(scores.get('A')!.rfm_f).toBe(1)
  })
  it('F2 for 1 visit', () => {
    const scores = computeRfmScores([customer('A', 5, 1)])
    expect(scores.get('A')!.rfm_f).toBe(2)
  })
  it('F3 for 2 visits', () => {
    const scores = computeRfmScores([customer('A', 5, 2)])
    expect(scores.get('A')!.rfm_f).toBe(3)
  })
  it('F3 for 3 visits', () => {
    const scores = computeRfmScores([customer('A', 5, 3)])
    expect(scores.get('A')!.rfm_f).toBe(3)
  })
  it('F4 for 4 visits', () => {
    const scores = computeRfmScores([customer('A', 5, 4)])
    expect(scores.get('A')!.rfm_f).toBe(4)
  })
  it('F4 for 7 visits', () => {
    const scores = computeRfmScores([customer('A', 5, 7)])
    expect(scores.get('A')!.rfm_f).toBe(4)
  })
  it('F5 for 8+ visits', () => {
    const scores = computeRfmScores([customer('A', 5, 8)])
    expect(scores.get('A')!.rfm_f).toBe(5)
  })
  it('F5 for 15 visits', () => {
    const scores = computeRfmScores([customer('A', 5, 15)])
    expect(scores.get('A')!.rfm_f).toBe(5)
  })
})

describe('computeRfmScores — M (relative quintile)', () => {
  it('M5 for highest spender in group', () => {
    const customers = [
      customer('A', 5, 3, 50),
      customer('B', 5, 3, 30),
      customer('C', 5, 3, 20),
      customer('D', 5, 3, 10),
      customer('E', 5, 3, 5),
    ]
    const scores = computeRfmScores(customers)
    expect(scores.get('A')!.rfm_m).toBe(5)
    expect(scores.get('E')!.rfm_m).toBe(1)
  })
  it('M scores are between 1 and 5', () => {
    const customers = Array.from({ length: 10 }, (_, i) => customer(`C${i}`, 5, 1, (i + 1) * 5))
    const scores = computeRfmScores(customers)
    for (const [, s] of scores) {
      expect(s.rfm_m).toBeGreaterThanOrEqual(1)
      expect(s.rfm_m).toBeLessThanOrEqual(5)
    }
  })
})
