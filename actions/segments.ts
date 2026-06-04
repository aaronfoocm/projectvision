'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function exportSegmentCSV(
  segment: string,
  rfmR: number[] = [],
  rfmF: number[] = [],
  rfmM: number[] = [],
): Promise<string> {
  const supabase = createServiceClient()
  const PAGE = 1000
  let from = 0
  const rows: Record<string, unknown>[] = []

  while (true) {
    let q = supabase
      .from('customers')
      .select('crm_id, first_name, last_name, mobile, segment, rfm_r, rfm_f, rfm_m, total_visits, last_visit_date, avg_gap_days, points_balance, outlet_count, favourite_item, current_loc_code')
      .eq('segment', segment)
      .eq('is_active', 1)
      .order('last_visit_date', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1)

    if (rfmR.length) q = q.in('rfm_r', rfmR)
    if (rfmF.length) q = q.in('rfm_f', rfmF)
    if (rfmM.length) q = q.in('rfm_m', rfmM)

    const { data, error } = await q

    if (error) break
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }

  const headers = ['CRM ID', 'First Name', 'Last Name', 'Mobile', 'Segment', 'R', 'F', 'M', 'Total Visits', 'Last Visit', 'Avg Gap (days)', 'Points', 'Outlets', 'Favourite Drink', 'Location']
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const lines = [
    headers.join(','),
    ...rows.map(r => [
      escape(r.crm_id),
      escape(r.first_name),
      escape(r.last_name),
      escape(r.mobile),
      escape(r.segment),
      escape(r.rfm_r),
      escape(r.rfm_f),
      escape(r.rfm_m),
      escape(r.total_visits),
      escape(r.last_visit_date ? String(r.last_visit_date).slice(0, 10) : ''),
      escape(r.avg_gap_days ? Math.round(Number(r.avg_gap_days)) : ''),
      escape(r.points_balance),
      escape(r.outlet_count),
      escape(r.favourite_item),
      escape(r.current_loc_code),
    ].join(',')),
  ]

  return lines.join('\n')
}
