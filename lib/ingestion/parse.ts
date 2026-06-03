import Papa from 'papaparse'
import type { Csv1Row, Csv2Row, Csv3Row } from '@/lib/types'

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0]
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return tabs >= commas ? '\t' : ','
}

function parseTsv<T>(content: string, skipEmpty: boolean, trimValues = true): T[] {
  const result = Papa.parse<T>(content, {
    header: true,
    delimiter: detectDelimiter(content),
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
  // The Sales Details export has several metadata rows before the real header.
  // Find the first line that contains the known anchor column and start from there.
  const lines = content.split('\n')
  const headerIdx = lines.findIndex(l => l.includes('Koppiku Ref #'))
  const trimmed = headerIdx > 0 ? lines.slice(headerIdx).join('\n') : content
  const rows = parseTsv<Csv2Row>(trimmed, false, false)
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
