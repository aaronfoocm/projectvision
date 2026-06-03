import type { Segment } from '@/lib/types'

export interface SegmentInput {
  crm_id: string
  total_visits: number
  outlet_count: number
  visits_last_60_days: number
  max_gap_last_60_days: number
  last_visit_days_ago: number
  avg_gap_days: number
  points_balance: number
  voucher_redeemed: number
  avg_item_quantity: number
  has_bill_with_qty_5_plus: boolean
  registered_days_ago: number
}

export function assignSegment(c: SegmentInput): Segment {
  if (c.outlet_count >= 3 && c.total_visits >= 3) return 'Explorer'
  if (c.visits_last_60_days >= 3 && c.max_gap_last_60_days <= 30) return 'Regular'
  if (c.has_bill_with_qty_5_plus && c.avg_item_quantity >= 3) return 'GroupBuyer'
  if (c.total_visits >= 3 && c.points_balance > 100 && c.voucher_redeemed === 0) return 'Hoarder'
  if (c.total_visits >= 2 && c.total_visits <= 4 && c.last_visit_days_ago > c.avg_gap_days * 1.5 && c.last_visit_days_ago > 45) return 'Flickerer'
  if (c.total_visits === 1 || (c.last_visit_days_ago > 90 && c.total_visits < 2)) return 'Ghost'
  if (c.total_visits === 0) return 'Dormant'
  return 'Ghost'
}
