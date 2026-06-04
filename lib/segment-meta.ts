import type { Segment } from './types'

export interface SegmentMeta {
  emoji: string
  label: string
  /** Tailwind text color for the segment name */
  color: string
  /** Tailwind bg class — /20 opacity for legibility */
  bg: string
  /** Tailwind border class — /40 opacity for clear definition */
  border: string
  /** Combined badge classes (bg + border + text) */
  badge: string
  /** Chip active state (used in segment filter chips) */
  chipActive: string
  headline: string
  detail: string
  action: string
}

export const SEGMENT_META: Record<Segment, SegmentMeta> = {
  Regular: {
    emoji: '⭐',
    label: 'Regular',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/40',
    badge: 'bg-green-500/20 border-green-500/40 text-green-300',
    chipActive: 'bg-green-500/20 border-green-500/50 text-green-300',
    headline: 'Consistent, loyal visitors',
    detail: '3+ visits in the last 60 days with gaps of ≤30 days between visits. Your core revenue base.',
    action: 'Reward with loyalty perks, early access, or personalised thank-you messages.',
  },
  Explorer: {
    emoji: '🧭',
    label: 'Explorer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    chipActive: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    headline: 'Multi-outlet adventurers',
    detail: '3+ outlets visited across at least 3 total transactions. They love discovering new locations.',
    action: 'Invite to newly opened outlets, send outlet-specific promotions.',
  },
  Flickerer: {
    emoji: '🎯',
    label: 'Flickerer',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/40',
    badge: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    chipActive: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    headline: 'Early signs of churn',
    detail: '2-4 total visits but their last visit is already longer than 1.5x their usual gap (and >45 days). Drifting away.',
    action: 'Send a re-engagement offer before they go fully dormant.',
  },
  Ghost: {
    emoji: '👻',
    label: 'Ghost',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    badge: 'bg-red-500/20 border-red-500/40 text-red-300',
    chipActive: 'bg-red-500/20 border-red-500/50 text-red-300',
    headline: 'One-time visitors',
    detail: 'Visited exactly once and never came back, or lapsed very early with fewer than 2 visits.',
    action: 'Win-back campaign — remind them what they ordered, offer a first-return incentive.',
  },
  Hoarder: {
    emoji: '💰',
    label: 'Hoarder',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    chipActive: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    headline: 'Points collectors, not redeemers',
    detail: '3+ visits, over 100 points accumulated, but zero voucher redemptions. Sitting on value.',
    action: 'Nudge to redeem — highlight expiry, show what their points can get them.',
  },
  GroupBuyer: {
    emoji: '👥',
    label: 'GroupBuyer',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/40',
    badge: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    chipActive: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    headline: 'Orders for a crowd',
    detail: 'Has placed at least one bill with 5+ items and maintains an average item quantity of 3+.',
    action: 'Target group deals, bundle promotions, and office/team catering offers.',
  },
  Dormant: {
    emoji: '💤',
    label: 'Dormant',
    color: 'text-stone-400',
    bg: 'bg-stone-500/20',
    border: 'border-stone-500/40',
    badge: 'bg-stone-500/20 border-stone-500/40 text-stone-300',
    chipActive: 'bg-stone-600/30 border-stone-500/50 text-stone-300',
    headline: 'Lost customers - 90+ day gap',
    detail: 'No visits in over 90 days with very few historical transactions. At high churn risk.',
    action: 'Last-chance reactivation — bold offer or personal outreach before writing off.',
  },
}

export const ALL_SEGMENTS: Segment[] = [
  'Regular', 'Explorer', 'Flickerer', 'Ghost', 'Hoarder', 'GroupBuyer', 'Dormant',
]
