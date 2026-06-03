import { describe, it, expect } from 'vitest'
import { deriveDrinkProfile } from './drink-profile'
import type { BillItem } from '@/lib/types'

function makeItem(overrides: Partial<BillItem>): BillItem {
  return {
    transaction_id: 'REF1', bill_line_no: 1, item_name: 'Latte (ICED)', item_code: 'EON004',
    order_start_time: '08:30:00', item_qty: 1, net_sales: 7.5, point_awarded: 7,
    point_redeemed: 0, is_modifier: false, parent_item_code: null, modifier_name: null,
    ...overrides,
  }
}

function makeModifier(name: string): BillItem {
  return makeItem({ is_modifier: true, item_name: name, modifier_name: name, order_start_time: null })
}

describe('deriveDrinkProfile', () => {
  it('detects ICED temperature', () => {
    expect(deriveDrinkProfile([makeItem({ item_name: 'Latte (ICED)' })]).preferred_temp).toBe('ICED')
  })
  it('detects HOT temperature', () => {
    expect(deriveDrinkProfile([makeItem({ item_name: 'Mocha (HOT)' })]).preferred_temp).toBe('HOT')
  })
  it('returns BOTH when tied', () => {
    expect(deriveDrinkProfile([makeItem({ item_name: 'Latte (ICED)' }), makeItem({ item_name: 'Mocha (HOT)' })]).preferred_temp).toBe('BOTH')
  })
  it('assigns MORNING for 08:30', () => {
    expect(deriveDrinkProfile([makeItem({ order_start_time: '08:30:00' })]).preferred_time_slot).toBe('MORNING')
  })
  it('assigns AFTERNOON for 13:00', () => {
    expect(deriveDrinkProfile([makeItem({ order_start_time: '13:00:00' })]).preferred_time_slot).toBe('AFTERNOON')
  })
  it('assigns EVENING for 17:00', () => {
    expect(deriveDrinkProfile([makeItem({ order_start_time: '17:00:00' })]).preferred_time_slot).toBe('EVENING')
  })
  it('assigns NIGHT for 21:00', () => {
    expect(deriveDrinkProfile([makeItem({ order_start_time: '21:00:00' })]).preferred_time_slot).toBe('NIGHT')
  })
  it('detects preferred milk from modifier', () => {
    expect(deriveDrinkProfile([makeItem({}), makeModifier('Coconut Milk')]).preferred_milk).toBe('Coconut Milk')
  })
  it('picks favourite drink by most frequent', () => {
    const items = [makeItem({ item_name: 'Latte (ICED)' }), makeItem({ item_name: 'Latte (ICED)' }), makeItem({ item_name: 'Mocha (HOT)' })]
    expect(deriveDrinkProfile(items).favourite_drink).toBe('Latte (ICED)')
  })
  it('captures top non-milk non-size modifiers', () => {
    const items = [makeItem({}), makeModifier('Vanilla Syrup'), makeModifier('Vanilla Syrup'), makeModifier('Caramel Syrup')]
    const profile = deriveDrinkProfile(items)
    expect(profile.top_modifier_1).toBe('Vanilla Syrup')
    expect(profile.top_modifier_2).toBe('Caramel Syrup')
  })
})
