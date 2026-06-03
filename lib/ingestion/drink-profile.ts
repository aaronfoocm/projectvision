import type { BillItem, PreferredTemp, TimeSlot } from '@/lib/types'

const MILK_KEYWORDS = ['coconut milk', 'oat milk', 'full cream', 'soy milk', 'skim milk', 'almond milk']
const SIZE_KEYWORDS = ['regular', 'large', 'small']

function getTimeSlot(time: string): TimeSlot {
  const hour = parseInt(time.split(':')[0], 10)
  if (hour >= 6 && hour < 11) return 'MORNING'
  if (hour >= 11 && hour < 15) return 'AFTERNOON'
  if (hour >= 15 && hour < 20) return 'EVENING'
  return 'NIGHT'
}

function mostFrequent<T>(arr: T[]): T | null {
  if (!arr.length) return null
  const counts = new Map<T, number>()
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export interface ComputedDrinkProfile {
  favourite_drink: string | null
  preferred_temp: PreferredTemp | null
  preferred_time_slot: TimeSlot | null
  preferred_milk: string | null
  preferred_size: string | null
  top_modifier_1: string | null
  top_modifier_2: string | null
}

export function deriveDrinkProfile(items: BillItem[]): ComputedDrinkProfile {
  const parents = items.filter(i => !i.is_modifier)
  const modifiers = items.filter(i => i.is_modifier)

  let iced = 0, hot = 0
  for (const p of parents) {
    if (p.item_name?.includes('(ICED)')) iced++
    else if (p.item_name?.includes('(HOT)')) hot++
  }
  let preferred_temp: PreferredTemp | null = null
  if (iced > 0 || hot > 0) preferred_temp = iced === hot ? 'BOTH' : iced > hot ? 'ICED' : 'HOT'

  const slots = parents.filter(p => p.order_start_time).map(p => getTimeSlot(p.order_start_time!))
  const preferred_time_slot = mostFrequent(slots)

  const milks = modifiers.filter(m => MILK_KEYWORDS.some(k => m.modifier_name?.toLowerCase().includes(k))).map(m => m.modifier_name!)
  const preferred_milk = mostFrequent(milks)

  const sizes = modifiers.filter(m => SIZE_KEYWORDS.includes(m.modifier_name?.toLowerCase() ?? '')).map(m => m.modifier_name!)
  const preferred_size = mostFrequent(sizes)

  const favourite_drink = mostFrequent(parents.map(p => p.item_name).filter(Boolean) as string[])

  const others = modifiers.filter(m => {
    const name = m.modifier_name?.toLowerCase() ?? ''
    return !MILK_KEYWORDS.some(k => name.includes(k)) && !SIZE_KEYWORDS.includes(name)
  })
  const otherCounts = new Map<string, number>()
  for (const m of others) otherCounts.set(m.modifier_name!, (otherCounts.get(m.modifier_name!) ?? 0) + 1)
  const top2 = [...otherCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])

  return { favourite_drink, preferred_temp, preferred_time_slot, preferred_milk, preferred_size, top_modifier_1: top2[0] ?? null, top_modifier_2: top2[1] ?? null }
}
