export interface RfmInput {
  crm_id: string
  last_visit_date: string | null
  visits_in_last_90_days: number
  avg_spend: number
}

export interface RfmScores {
  rfm_r: number
  rfm_f: number
  rfm_m: number
}

function daysSince(dateStr: string, today: Date): number {
  return Math.floor((today.getTime() - new Date(dateStr).getTime()) / 86_400_000)
}

function quintileScore(value: number, sorted: number[], higherIsBetter: boolean): number {
  if (sorted.length === 0) return 3
  const rank = sorted.filter(v => v <= value).length
  const pct = rank / sorted.length
  const raw = Math.max(1, Math.ceil(pct * 5))
  return higherIsBetter ? raw : 6 - raw
}

export function computeRfmScores(
  customers: RfmInput[],
  today: Date = new Date(),
): Map<string, RfmScores> {
  const recencies = customers
    .map(c => (c.last_visit_date ? daysSince(c.last_visit_date, today) : 99_999))
    .sort((a, b) => a - b)
  const frequencies = customers.map(c => c.visits_in_last_90_days).sort((a, b) => a - b)
  const monetaries = customers.map(c => c.avg_spend).sort((a, b) => a - b)

  const result = new Map<string, RfmScores>()
  for (const c of customers) {
    const recency = c.last_visit_date ? daysSince(c.last_visit_date, today) : 99_999
    result.set(c.crm_id, {
      rfm_r: quintileScore(recency, recencies, false),
      rfm_f: quintileScore(c.visits_in_last_90_days, frequencies, true),
      rfm_m: quintileScore(c.avg_spend, monetaries, true),
    })
  }
  return result
}
