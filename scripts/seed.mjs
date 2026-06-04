import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
const { parse } = Papa
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://vpvolbqgnwgwflikdryd.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
const DL = '/Users/aaronfoo/Downloads'

const PAIRS = [
  ['orders_export_20260603_222302.csv', 'orders_export_20260603_222304.csv'],
  ['orders_export_20260603_222219.csv', 'orders_export_20260603_222221.csv'],
  ['orders_export_20260603_222140.csv', 'orders_export_20260603_222142.csv'],
  ['orders_export_20260603_222023.csv', 'orders_export_20260603_222024.csv'],
  ['orders_export_20260603_221936.csv', 'orders_export_20260603_221938.csv'],
  ['orders_export_20260603_221825.csv', 'orders_export_20260603_221826.csv'],
]

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function normaliseMY(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return '60' + digits
}

function parseCsv(filePath, skipToHeader) {
  let content = readFileSync(filePath, 'utf-8')
  if (skipToHeader) {
    const lines = content.split('\n')
    const idx = lines.findIndex(l => l.includes(skipToHeader))
    if (idx > 0) content = lines.slice(idx).join('\n')
  }
  return parse(content, {
    header: true, skipEmptyLines: true,
    transformHeader: h => h.trim(),
    transform: v => v.trim(),
  }).data
}

async function seedPair(csv1File, csv2File) {
  const csv1 = parseCsv(`${DL}/${csv1File}`)
  const csv2 = parseCsv(`${DL}/${csv2File}`, 'Koppiku Ref #')

  const allMobiles = [...new Set(csv1.map(r => normaliseMY(r['Mobile #'])).filter(Boolean))]
  const mobileToId = new Map()
  for (let i = 0; i < allMobiles.length; i += 500) {
    const { data } = await supabase.from('customers').select('crm_id, mobile').in('mobile', allMobiles.slice(i, i + 500))
    for (const c of data ?? []) if (c.mobile) mobileToId.set(c.mobile, c.crm_id)
  }

  const refToCustomerId = new Map()
  const txns = []
  let unmatched = 0
  for (const row of csv1) {
    const ref = row['Koppiku Ref #']
    if (!ref) continue
    const customerId = mobileToId.get(normaliseMY(row['Mobile #'])) ?? null
    refToCustomerId.set(ref, customerId)
    if (!customerId) { unmatched++; continue }
    txns.push({
      koppiku_ref: ref,
      zeoniq_ref: row['Zeoniq Reference #'] || null,
      razorpay_ref: row['Razorpay #'] || null,
      customer_id: customerId,
      outlet_code: row['Location'] || null,
      transaction_date: row['Date'] || null,
      status: row['Status'] || null,
      total_amount: parseFloat(row['Total Amount']) || 0,
      net_sales: parseFloat(row['Net Sales']) || 0,
    })
  }

  for (let i = 0; i < txns.length; i += 500) {
    const { error } = await supabase.from('transactions').upsert(txns.slice(i, i + 500), { onConflict: 'koppiku_ref' })
    if (error) console.error(`  ✗ txn: ${error.message}`)
  }

  // Build Bill Line No. → ref lookup so modifier rows (empty Koppiku Ref #) inherit parent's ref
  const lineToRef = new Map()
  for (const row of csv2) {
    if (row['Bill Line No.'] && row['Koppiku Ref #']) lineToRef.set(row['Bill Line No.'], row['Koppiku Ref #'])
  }

  const billItems = []
  for (const row of csv2) {
    const isModifier = !row['Zeoniq Reference #'] && !row['Koppiku Ref #']
    const ref = row['Koppiku Ref #'] || lineToRef.get(row['Parent Bill Line No.'] ?? '') || ''
    if (!ref) continue
    const customerId = refToCustomerId.get(ref)
    if (!customerId) continue
    billItems.push({
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
      modifier_name: !(row['Zeoniq Reference #']) ? (row['Item'] || null) : null,
    })
  }

  for (let i = 0; i < billItems.length; i += 500) {
    const { error } = await supabase.from('bill_items').insert(billItems.slice(i, i + 500))
    if (error && !error.message.includes('duplicate')) console.error(`  ✗ items: ${error.message}`)
  }

  await supabase.from('upload_log').insert([
    { file_type: 'transactions', row_count: txns.length, status: 'success' },
    { file_type: 'line_items', row_count: billItems.length, status: 'success' },
  ])

  return { txns: txns.length, items: billItems.length, unmatched }
}

// ── Run all pairs ─────────────────────────────────────────────────────────────
for (const [csv1, csv2] of PAIRS) {
  process.stdout.write(`▶ ${csv1} … `)
  const r = await seedPair(csv1, csv2)
  console.log(`${r.txns} txns · ${r.items} items · ${r.unmatched} unmatched`)
}

console.log('\n✅ All pairs seeded.')
