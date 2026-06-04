/**
 * Re-seeds bill items (with modifiers) for all 8 transaction pairs.
 * Run after clearing bill_items table.
 */
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
const { parse } = Papa
import { readFileSync } from 'fs'

const sb = createClient(
  'https://vpvolbqgnwgwflikdryd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdm9sYnFnbndnd2ZsaWtkcnlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQzODU4MywiZXhwIjoyMDk2MDE0NTgzfQ.6RFgw6bDtD8rUZ_JHes7KF0L0q7NE4A6uGdw-1xTRXg'
)
const DL = '/Users/aaronfoo/Downloads'

const PAIRS = [
  ['orders_export_20260603_222611.csv', 'orders_export_20260603_222612.csv'],
  ['orders_export_20260603_222504.csv', 'orders_export_20260603_222505.csv'],
  ['orders_export_20260603_222302.csv', 'orders_export_20260603_222304.csv'],
  ['orders_export_20260603_222219.csv', 'orders_export_20260603_222221.csv'],
  ['orders_export_20260603_222140.csv', 'orders_export_20260603_222142.csv'],
  ['orders_export_20260603_222023.csv', 'orders_export_20260603_222024.csv'],
  ['orders_export_20260603_221936.csv', 'orders_export_20260603_221938.csv'],
  ['orders_export_20260603_221825.csv', 'orders_export_20260603_221826.csv'],
]

function parseCsv(path, skipToHeader) {
  let content = readFileSync(path, 'utf-8')
  if (skipToHeader) {
    const lines = content.split('\n')
    const idx = lines.findIndex(l => l.includes(skipToHeader))
    if (idx > 0) content = lines.slice(idx).join('\n')
  }
  return parse(content, { header: true, skipEmptyLines: false, transformHeader: h => h.trim(), transform: v => v.trim() }).data
}

// Load customer ref map once
console.log('▶ Loading transaction→customer map …')
let from = 0
const refToCustomer = new Map()
while (true) {
  const { data } = await sb.from('transactions').select('koppiku_ref, customer_id').not('customer_id', 'is', null).range(from, from + 999)
  for (const t of data ?? []) refToCustomer.set(t.koppiku_ref, t.customer_id)
  if ((data ?? []).length < 1000) break
  from += 1000
}
console.log(`  ${refToCustomer.size} transactions loaded\n`)

let totalItems = 0

for (const [csv1File, csv2File] of PAIRS) {
  const csv2 = parseCsv(`${DL}/${csv2File}`, 'Koppiku Ref #')

  // Build Bill Line No. → Koppiku Ref # for modifier rows
  const lineToRef = new Map()
  for (const row of csv2) {
    if (row['Bill Line No.'] && row['Koppiku Ref #']) lineToRef.set(row['Bill Line No.'], row['Koppiku Ref #'])
  }

  const items = []
  for (const row of csv2) {
    const isModifier = !row['Zeoniq Reference #'] && !row['Koppiku Ref #']
    const ref = row['Koppiku Ref #'] || lineToRef.get(row['Parent Bill Line No.'] ?? '') || ''
    if (!ref) continue
    const customerId = refToCustomer.get(ref)
    if (!customerId) continue
    items.push({
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
    })
  }

  let mods = items.filter(i => i.is_modifier).length
  process.stdout.write(`▶ ${csv2File}: ${items.length} items (${mods} modifiers) … `)

  for (let i = 0; i < items.length; i += 500) {
    const { error } = await sb.from('bill_items').insert(items.slice(i, i + 500))
    if (error && !error.message.includes('duplicate')) process.stdout.write(`✗ ${error.message} `)
  }
  totalItems += items.length
  console.log('✓')
}

console.log(`\n✅ ${totalItems.toLocaleString()} bill items seeded across ${PAIRS.length} pairs.`)
