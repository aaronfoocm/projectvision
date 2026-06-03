import Papa from 'papaparse'
import type { Csv1Row, Csv2Row, Csv3Row } from '@/lib/types'

function parseTsv<T>(content: string, skipEmpty: boolean, trimValues = true): T[] {
  const result = Papa.parse<T>(content, {
    header: true,
    delimiter: '\t',
    skipEmptyLines: skipEmpty ? true : false,
    transformHeader: (h) => h.trim(),
    transform: trimValues ? (v) => v.trim() : undefined,
  })
  return result.data
}

export function parseCsv1(content: string): Csv1Row[] {
  return parseTsv<Csv1Row>(content, true)
}

export function parseCsv2(content: string): Csv2Row[] {
  const rows = parseTsv<Csv2Row>(content, false, false)
  return rows.filter(row => Object.values(row as unknown as Record<string, string>).some(v => v !== ''))
}

export function parseCsv3(content: string): Csv3Row[] {
  return parseTsv<Csv3Row>(content, true)
}

export function detectMissingColumns(
  rows: Record<string, string>[],
  required: string[],
): string[] {
  if (rows.length === 0) return required
  const headers = Object.keys(rows[0])
  return required.filter(col => !headers.includes(col))
}
