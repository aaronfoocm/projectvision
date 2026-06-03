import { describe, it, expect } from 'vitest'
import { joinCsvs } from './join'
import type { Csv1Row, Csv2Row, Csv3Row } from '@/lib/types'

const csv3: Csv3Row[] = [{
  id: '1', crm_id: 'CRM001', 'First Name': 'John', 'Middle Name': '', 'Last Name': 'Doe',
  Email: 'john@example.com', 'Mobile Number': '107089381', 'Current Loc Code': 'KLS-KUL-040',
  'Is Active': '1', 'Cashback Rewards Points': '500', 'Cashback Prev Rewards Points': '300',
  'Welcome Voucher': '1', 'Created at': '2025-03-02',
}]

const csv1: Csv1Row[] = [{
  Date: '2026-06-01 07:36', 'Zeoniq Reference #': 'EO010477', 'Koppiku Ref #': 'REF001',
  'Razorpay #': 'pay_abc', 'Customer Name': '', 'Mobile #': '107089381',
  Location: 'KLS-KUL-040', Status: 'Closed', 'Total Amount': '7.5', 'Net Sales': '7.5',
}]

const csv2: Csv2Row[] = [
  {
    'Bill Line No.': '1', 'Business Date': '2026-06-01', 'Zeoniq Reference #': 'EO010477',
    'Koppiku Ref #': 'REF001', Outlet: 'KLS-KUL-040', Item: 'Latte (ICED)', Code: 'EON004',
    'Order Start Time': '07:36:52', 'Item Qty': '1', 'Net Sales': '7.5',
    'Point Awarded': '7', 'Point Redeemed': '0', 'Parent Item': '', 'Parent Code': '', 'Parent Bill Line No.': '',
  },
  {
    'Bill Line No.': '', 'Business Date': '', 'Zeoniq Reference #': '',
    'Koppiku Ref #': 'REF001', Outlet: '', Item: ' - Regular', Code: 'NM001',
    'Order Start Time': '', 'Item Qty': '0', 'Net Sales': '0',
    'Point Awarded': '0', 'Point Redeemed': '0', 'Parent Item': 'Latte (ICED)', 'Parent Code': 'EON004', 'Parent Bill Line No.': '1',
  },
]

describe('joinCsvs', () => {
  it('resolves customer by mobile', () => {
    const result = joinCsvs(csv1, csv2, csv3)
    expect(result.customerTransactions.has('CRM001')).toBe(true)
    expect(result.customerTransactions.get('CRM001')).toHaveLength(1)
  })

  it('links bill items to customer via koppiku_ref', () => {
    const result = joinCsvs(csv1, csv2, csv3)
    const items = result.customerBillItems.get('CRM001')
    expect(items).toHaveLength(2)
  })

  it('identifies modifier rows by empty zeoniq_ref', () => {
    const result = joinCsvs(csv1, csv2, csv3)
    const items = result.customerBillItems.get('CRM001')!
    const modifier = items.find(i => i.is_modifier)
    expect(modifier).toBeDefined()
    expect(modifier!.modifier_name).toBe(' - Regular')
  })

  it('puts unmatched transactions in unknownTransactions', () => {
    const unknownCsv1: Csv1Row[] = [{
      ...csv1[0], 'Mobile #': '9999999999', 'Koppiku Ref #': 'REF_UNKNOWN',
    }]
    const result = joinCsvs(unknownCsv1, [], csv3)
    expect(result.unknownTransactions).toHaveLength(1)
  })

  it('normalises mobile with leading +', () => {
    const csv3WithPlus = [{ ...csv3[0], 'Mobile Number': '+60107089381' }]
    const csv1WithPlus = [{ ...csv1[0], 'Mobile #': '60107089381' }]
    const result = joinCsvs(csv1WithPlus, [], csv3WithPlus)
    expect(result.customerTransactions.has('CRM001')).toBe(true)
  })
})
