export interface RfmInput {
  crm_id: string
  last_visit_date: string | null
  visits_in_last_60_days: number
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

function rScore(daysAgo: number): number {
  if (daysAgo <= 7) return 5
  if (daysAgo <= 14) return 4
  if (daysAgo <= 30) return 3
  if (daysAgo <= 60) return 2
  return 1
}

function fScore(visits60: number): number {
  if (visits60 >= 8) return 5
  if (visits60 >= 4) return 4
  if (visits60 >= 2) return 3
  if (visits60 >= 1) return 2
  return 1
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
  const monetaries = customers.map(c => c.avg_spend).sort((a, b) => a - b)

  const result = new Map<string, RfmScores>()
  for (const c of customers) {
    const daysAgo = c.last_visit_date ? daysSince(c.last_visit_date, today) : 99_999
    result.set(c.crm_id, {
      rfm_r: rScore(daysAgo),
      rfm_f: fScore(c.visits_in_last_60_days),
      rfm_m: quintileScore(c.avg_spend, monetaries, true),
    })
  }
  return result
}
