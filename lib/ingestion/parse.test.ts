import { describe, it, expect } from 'vitest'
import { parseCsv1, parseCsv2, parseCsv3, detectMissingColumns } from './parse'

const CSV1_SAMPLE = `Date\tZeoniq Reference #\tKoppiku Ref #\tRazorpay #\tCustomer Name\tMobile #\tLocation\tStatus\tTotal Amount\tNet Sales
2026-06-01 07:36\tEO010477\t1D8EB74KLSKUL040\tfree_abc\t\t107089381\tKLS-KUL-040\tPreparing\t0\t7.5
2026-06-01 07:42\tEO001869\t1MM7BMVKSISEL062\tpay_xyz\tIzzatul\t1173719141\tKSI-SEL-062\tClosed\t2.46\t3.36`

const CSV2_SAMPLE = `Bill Line No.\tBusiness Date\tZeoniq Reference #\tKoppiku Ref #\tOutlet\tItem\tCode\tOrder Start Time\tItem Qty\tNet Sales\tPoint Awarded\tPoint Redeemed\tParent Item\tParent Code\tParent Bill Line No.
1\t2026-06-01\tEO010477\t1D8EB74KLSKUL040\tKLS-KUL-040\tLatte (ICED)\tEON004\t07:36:52\t1\t7.5\t0\t0\t\t\t
\t\t\t1D8EB74KLSKUL040\t\t - Regular\tNM001\t\t0\t0\t0\t0\tLatte (ICED)\tEON004\t1`

const CSV3_SAMPLE = `id\tcrm_id\tFirst Name\tMiddle Name\tLast Name\tEmail\tMobile Number\tCurrent Loc Code\tIs Active\tCashback Rewards Points\tCashback Prev Rewards Points\tWelcome Voucher\tCreated at
1\tCRM001\tJohn\t\tDoe\tjohn@example.com\t107089381\tKLS-KUL-040\t1\t0\t0\t0\t2025-03-02 01:11:17`

describe('parseCsv1', () => {
  it('parses tab-separated bill headers', () => {
    const rows = parseCsv1(CSV1_SAMPLE)
    expect(rows).toHaveLength(2)
    expect(rows[0]['Koppiku Ref #']).toBe('1D8EB74KLSKUL040')
    expect(rows[0]['Net Sales']).toBe('7.5')
  })
})

describe('parseCsv2', () => {
  it('keeps modifier rows (empty Zeoniq ref)', () => {
    const rows = parseCsv2(CSV2_SAMPLE)
    expect(rows).toHaveLength(2)
    expect(rows[1]['Zeoniq Reference #']).toBe('')
    expect(rows[1]['Item']).toBe(' - Regular')
  })
})

describe('parseCsv3', () => {
  it('parses customer rows', () => {
    const rows = parseCsv3(CSV3_SAMPLE)
    expect(rows).toHaveLength(1)
    expect(rows[0]['crm_id']).toBe('CRM001')
    expect(rows[0]['Mobile Number']).toBe('107089381')
  })
})

describe('detectMissingColumns', () => {
  it('returns names of columns absent from data', () => {
    const rows = [{ Name: 'a', Amount: '1' }]
    const missing = detectMissingColumns(rows, ['Name', 'Amount', 'Date'])
    expect(missing).toEqual(['Date'])
  })

  it('returns all required columns when rows is empty', () => {
    const missing = detectMissingColumns([], ['Name'])
    expect(missing).toEqual(['Name'])
  })
})
