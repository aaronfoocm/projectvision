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
  Champion: {
    emoji: '⭐',
    label: 'Champion',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    chipActive: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    headline: 'Our most devoted regulars',
    detail: 'Visited within the last 14 days with 4+ total visits. These are our highest-value, most habitual customers.',
    action: 'Treat them like VIPs — early access to new products, personalised thank you messages. Never send generic promos; it feels like a demotion.',
  },
  Regular: {
    emoji: '☕',
    label: 'Regular',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/40',
    badge: 'bg-green-500/20 border-green-500/40 text-green-300',
    chipActive: 'bg-green-500/20 border-green-500/50 text-green-300',
    headline: 'Consistent, returning customers',
    detail: 'Visited within the last 30 days with 3+ total visits. Habit is forming — our core revenue base.',
    action: 'Reinforce the habit. Visit milestone nudges, streak messages, "you\'re 2 visits away from your next reward."',
  },
  NewTrial: {
    emoji: '🆕',
    label: 'New / Trial',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    chipActive: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    headline: 'Just getting started',
    detail: 'Visited within the last 30 days but fewer than 3 total visits. They\'ve tried us — now convert them into regulars.',
    action: 'Strike within 48 hours with a 2nd visit offer. Day 7: prompt them to complete their profile for birthday rewards.',
  },
  AtRisk: {
    emoji: '⚡',
    label: 'At-Risk',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/40',
    badge: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    chipActive: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    headline: 'The rescue window',
    detail: 'Last visit was 31–60 days ago with 3+ total visits. They had a habit — it\'s slipping, but still very winnable.',
    action: 'Most time-sensitive segment. Weekly automated trigger: reference their points balance and make it personal. Every day we wait, the window closes.',
  },
  LapsedLoyal: {
    emoji: '💔',
    label: 'Lapsed Loyal',
    color: 'text-rose-400',
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
    chipActive: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
    headline: 'They used to love us',
    detail: 'Last visit was 60+ days ago with 6+ total visits. These were our people — highest priority win-back.',
    action: 'Personalised WhatsApp with a strong comeback offer. Remind them what they ordered. Max 2 contacts; if no response, suppress and don\'t waste credits.',
  },
  Dormant: {
    emoji: '😴',
    label: 'Dormant',
    color: 'text-stone-400',
    bg: 'bg-stone-500/20',
    border: 'border-stone-500/40',
    badge: 'bg-stone-500/20 border-stone-500/40 text-stone-300',
    chipActive: 'bg-stone-600/30 border-stone-500/50 text-stone-300',
    headline: 'Fading out',
    detail: 'Last visit was 60+ days ago with 2–5 total visits. Some history, but loyalty never fully formed.',
    action: 'Points expiry warning for members with 200+ points — urgency is the hook. One push blast. If no response, time to let go.',
  },
  Ghost: {
    emoji: '👻',
    label: 'Ghost',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    badge: 'bg-red-500/20 border-red-500/40 text-red-300',
    chipActive: 'bg-red-500/20 border-red-500/50 text-red-300',
    headline: 'One-timers and early lapsers',
    detail: 'Last visit was 60+ days ago with 1–2 total visits. Visited once or twice and never came back.',
    action: 'Single push only — no WhatsApp, protect our credits. Remind them what they ordered. No response in 14 days → suppress permanently.',
  },
  NeverTransacted: {
    emoji: '🌱',
    label: 'Never Transacted',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    chipActive: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    headline: 'Registered but not yet a customer',
    detail: 'Registered but 0 visits. This is an activation problem, not a retention one.',
    action: 'Separate track entirely. Push 50% off first purchase to see if they convert. Don\'t treat them like lapsed members.',
  },
}

export const ALL_SEGMENTS: Segment[] = [
  'Champion', 'Regular', 'NewTrial', 'AtRisk', 'LapsedLoyal', 'Dormant', 'Ghost', 'NeverTransacted',
]
