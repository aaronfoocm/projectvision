import { describe, it, expect } from 'vitest'
import { assignSegment, type SegmentInput } from './segments'

const base: SegmentInput = {
  crm_id: 'X', total_visits: 0, outlet_count: 1,
  visits_last_60_days: 0, max_gap_last_60_days: 0,
  last_visit_days_ago: 0, avg_gap_days: 10,
  points_balance: 0, voucher_redeemed: 0,
  avg_item_quantity: 1, has_bill_with_qty_5_plus: false,
  registered_days_ago: 30,
}

describe('assignSegment', () => {
  it('assigns Explorer for 3+ outlets and 3+ visits', () => {
    expect(assignSegment({ ...base, outlet_count: 3, total_visits: 5 })).toBe('Explorer')
  })
  it('assigns Regular for 3+ visits in 60 days with max gap ≤ 30', () => {
    expect(assignSegment({ ...base, visits_last_60_days: 3, max_gap_last_60_days: 20, total_visits: 3 })).toBe('Regular')
  })
  it('Explorer wins over Regular', () => {
    expect(assignSegment({ ...base, outlet_count: 3, total_visits: 5, visits_last_60_days: 3, max_gap_last_60_days: 10 })).toBe('Explorer')
  })
  it('assigns GroupBuyer for large orders with high avg qty', () => {
    expect(assignSegment({ ...base, has_bill_with_qty_5_plus: true, avg_item_quantity: 3 })).toBe('GroupBuyer')
  })
  it('assigns Hoarder for 3+ visits, >100 points, zero redemptions', () => {
    expect(assignSegment({ ...base, total_visits: 4, points_balance: 150, voucher_redeemed: 0 })).toBe('Hoarder')
  })
  it('assigns Flickerer for 2–4 visits, overdue gap, >45 days ago', () => {
    expect(assignSegment({ ...base, total_visits: 3, last_visit_days_ago: 50, avg_gap_days: 20 })).toBe('Flickerer')
  })
  it('assigns Ghost for 1 visit ever', () => {
    expect(assignSegment({ ...base, total_visits: 1 })).toBe('Ghost')
  })
  it('assigns Ghost for lapsed >90 days with <2 visits', () => {
    expect(assignSegment({ ...base, total_visits: 1, last_visit_days_ago: 100 })).toBe('Ghost')
  })
  it('assigns Dormant for zero visits', () => {
    expect(assignSegment({ ...base, total_visits: 0, registered_days_ago: 10 })).toBe('Dormant')
  })
})
