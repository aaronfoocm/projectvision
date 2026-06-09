import type { Segment } from '@/lib/types'

export interface SegmentInput {
  crm_id: string
  total_visits: number
  last_visit_days_ago: number  // pass 9999 when no visits on record
}

export function assignSegment(c: SegmentInput): Segment {
  if (c.total_visits === 0) return 'NeverTransacted'
  if (c.last_visit_days_ago <= 14 && c.total_visits >= 4) return 'Champion'
  if (c.last_visit_days_ago <= 30 && c.total_visits >= 3) return 'Regular'
  if (c.last_visit_days_ago <= 30) return 'NewTrial'
  if (c.last_visit_days_ago <= 60 && c.total_visits >= 3) return 'AtRisk'
  if (c.last_visit_days_ago > 60 && c.total_visits >= 6) return 'LapsedLoyal'
  if (c.last_visit_days_ago > 60 && c.total_visits >= 2) return 'Dormant'
  return 'Ghost'
}
