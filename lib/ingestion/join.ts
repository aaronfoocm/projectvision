import type { Csv1Row, Csv2Row, Csv3Row, Transaction, BillItem } from '@/lib/types'

export interface JoinedData {
  customerTransactions: Map<string, Transaction[]>
  customerBillItems: Map<string, BillItem[]>
  customerById: Map<string, Csv3Row>
  mobileToId: Map<string, string>
  unknownTransactions: Transaction[]
}

function normaliseMobile(raw: string): string {
  return raw.replace(/^\+/, '').replace(/\s/g, '')
}

export function joinCsvs(csv1: Csv1Row[], csv2: Csv2Row[], csv3: Csv3Row[]): JoinedData {
  const mobileToId = new Map<string, string>()
  const customerById = new Map<string, Csv3Row>()

  for (const row of csv3) {
    const crmId = row.crm_id || row.id
    if (!crmId) continue
    customerById.set(crmId, row)
    const mobile = normaliseMobile(row['Mobile Number'] || '')
    if (mobile) mobileToId.set(mobile, crmId)
  }

  const refToCustomerId = new Map<string, string | null>()
  const customerTransactions = new Map<string, Transaction[]>()
  const unknownTransactions: Transaction[] = []

  for (const row of csv1) {
    const ref = row['Koppiku Ref #']
    if (!ref) continue
    const mobile = normaliseMobile(row['Mobile #'] || '')
    const customerId = mobileToId.get(mobile) ?? null
    refToCustomerId.set(ref, customerId)

    const tx: Transaction = {
      koppiku_ref: ref,
      zeoniq_ref: row['Zeoniq Reference #'] || null,
      razorpay_ref: row['Razorpay #'] || null,
      customer_id: customerId,
      outlet_code: row['Location'] || null,
      transaction_date: row['Date'] || null,
      status: row['Status'] || null,
      total_amount: parseFloat(row['Total Amount']) || 0,
      net_sales: parseFloat(row['Net Sales']) || 0,
    }

    if (customerId) {
      const arr = customerTransactions.get(customerId) ?? []
      arr.push(tx)
      customerTransactions.set(customerId, arr)
    } else {
      unknownTransactions.push(tx)
    }
  }

  const customerBillItems = new Map<string, BillItem[]>()

  for (const row of csv2) {
    const ref = row['Koppiku Ref #']
    if (!ref) continue
    const customerId = refToCustomerId.get(ref)
    if (!customerId) continue

    const isModifier = !row['Zeoniq Reference #']
    const item: BillItem = {
      transaction_id: ref,
      bill_line_no: parseInt(row['Bill Line No.']) || null,
      item_name: row['Item'] || null,
      item_code: row['Code'] || null,
      order_start_time: row['Order Start Time'] || null,
      item_qty: parseInt(row['Item Qty']) || 0,
      net_sales: parseFloat(row['Net Sales']) || 0,
      point_awarded: parseFloat(row['Point Awarded']) || 0,
      point_redeemed: parseFloat(row['Point Redeemed']) || 0,
      is_modifier: isModifier,
      parent_item_code: row['Parent Code'] || null,
      modifier_name: isModifier ? (row['Item'] || null) : null,
    }

    const arr = customerBillItems.get(customerId) ?? []
    arr.push(item)
    customerBillItems.set(customerId, arr)
  }

  return { customerTransactions, customerBillItems, customerById, mobileToId, unknownTransactions }
}
