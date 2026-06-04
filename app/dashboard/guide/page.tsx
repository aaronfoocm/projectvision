import { SEGMENT_META, ALL_SEGMENTS } from '@/lib/segment-meta'

const RFM_DIMS = [
  {
    letter: 'R', name: 'Recency', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20',
    what: 'Days since last visit, scored 1–5 across all customers as quintiles.',
    bands: [
      { score: 5, label: 'Visited within 63 days',      pct: 'Top 20%' },
      { score: 4, label: '63 – 288 days ago',            pct: '' },
      { score: 3, label: '288 – 364 days ago',           pct: '' },
      { score: 2, label: '364 – 401 days ago',           pct: '' },
      { score: 1, label: '401+ days ago',                pct: 'Bottom 20%' },
    ],
    action: 'Low R customers are drifting — send a win-back offer before they disappear.',
  },
  {
    letter: 'F', name: 'Frequency', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20',
    what: 'Total visits on record, scored 1–5 as quintiles across all customers.',
    bands: [
      { score: 5, label: '9+ visits',   pct: 'Top 20%' },
      { score: 4, label: '3 – 9 visits', pct: '' },
      { score: 3, label: '1 – 3 visits', pct: '' },
      { score: 2, label: '1 visit',      pct: '' },
      { score: 1, label: '1 visit',      pct: 'Bottom 20% — single visit' },
    ],
    action: 'High F customers are habitual — reward them before a competitor does.',
  },
  {
    letter: 'M', name: 'Monetary', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20',
    what: 'Average spend per visit (net sales ÷ visits), scored 1–5 as quintiles.',
    bands: [
      { score: 5, label: 'Highest average ticket', pct: 'Top 20% spenders' },
      { score: 4, label: 'Above-average spend',    pct: '' },
      { score: 3, label: 'Mid-range spend',        pct: '' },
      { score: 2, label: 'Below-average spend',    pct: '' },
      { score: 1, label: 'Lowest average ticket',  pct: 'Bottom 20% spenders' },
    ],
    action: 'High M + low F = high-value but irregular — a loyalty nudge can lock them in.',
  },
]

const JOURNEY_STEPS = [
  { label: 'Customer registers',   detail: 'Enters as Dormant — no purchase yet.',   color: 'bg-stone-700' },
  { label: 'First visit',          detail: 'Segment re-evaluated. Ghost if they don\'t return quickly.', color: 'bg-red-500/50' },
  { label: 'Building habit',       detail: '2–4 visits. Flickerer risk if gaps widen.', color: 'bg-orange-500/50' },
  { label: 'Loyal customer',       detail: 'Regular or Explorer. Highest lifetime value.', color: 'bg-green-500/50' },
  { label: 'Churn signal',         detail: 'Gap exceeds 1.5× normal — action triggered.', color: 'bg-orange-500/50' },
  { label: 'Win-back attempt',     detail: 'WhatsApp or in-store offer sent.', color: 'bg-blue-500/50' },
  { label: 'Outcome recorded',     detail: 'Visited, redeemed, or no response — loop repeats.', color: 'bg-stone-600' },
]

export default function GuidePage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Guide</h1>
        <p className="text-stone-500 text-sm mt-0.5">How Project Vision segments customers, scores them, and drives action.</p>
      </div>

      {/* ── Segments ──────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-white font-bold text-base mb-1">Segments</h2>
        <p className="text-stone-500 text-sm mb-5 leading-relaxed">
          Every active customer is assigned to exactly one segment based on their visit history,
          recency, gap patterns, points, and order behaviour. Segments are recalculated on each
          CSV upload.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {ALL_SEGMENTS.map(seg => {
            const m = SEGMENT_META[seg]
            return (
              <div key={seg} className={`${m.bg} border ${m.border} rounded-xl p-4`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap mb-1">
                      <span className={`text-sm font-bold ${m.color}`}>{seg}</span>
                      <span className="text-stone-400 text-sm">{m.headline}</span>
                    </div>
                    <p className="text-stone-500 text-xs leading-relaxed mb-2">{m.detail}</p>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wide mt-0.5 flex-shrink-0">Action</span>
                      <p className="text-stone-300 text-xs">{m.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── RFM ───────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-white font-bold text-base mb-1">RFM Score</h2>
        <p className="text-stone-500 text-sm mb-5 leading-relaxed">
          Each customer has an RFM score displayed as{' '}
          <span className="font-mono text-green-400">R</span>
          <span className="text-stone-600">-</span>
          <span className="font-mono text-blue-400">F</span>
          <span className="text-stone-600">-</span>
          <span className="font-mono text-amber-400">M</span>.{' '}
          Scores are quintiles (1–5) calculated across all customers — so a 5 means top 20%,
          a 1 means bottom 20%. Use RFM to cross-cut within a segment: a Ghost with R=2 is
          more recoverable than one with R=1.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {RFM_DIMS.map(({ letter, name, color, bg, what, bands, action }) => (
            <div key={letter} className={`border rounded-xl p-4 ${bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-2xl font-black font-mono ${color}`}>{letter}</span>
                <span className={`text-sm font-semibold ${color}`}>{name}</span>
              </div>
              <p className="text-stone-400 text-xs leading-relaxed mb-3">{what}</p>
              <div className="space-y-1 mb-3">
                {bands.map(({ score, label, pct }) => (
                  <div key={score} className="flex items-center gap-2">
                    <span className={`text-xs font-black font-mono w-3 ${color}`}>{score}</span>
                    <span className="text-stone-400 text-xs flex-1">{label}</span>
                    {pct && <span className="text-stone-600 text-[10px]">{pct}</span>}
                  </div>
                ))}
              </div>
              <p className={`text-xs font-medium ${color} leading-relaxed border-t border-white/5 pt-2`}>{action}</p>
            </div>
          ))}
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-center gap-6">
          <div className="text-center">
            <div className="font-mono text-lg font-bold">
              <span className="text-green-400">5</span>
              <span className="text-stone-600">-</span>
              <span className="text-blue-400">5</span>
              <span className="text-stone-600">-</span>
              <span className="text-amber-400">5</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">Best possible</div>
          </div>
          <div className="text-stone-600 text-sm">vs</div>
          <div className="text-center">
            <div className="font-mono text-lg font-bold">
              <span className="text-green-400/40">1</span>
              <span className="text-stone-600">-</span>
              <span className="text-blue-400/40">1</span>
              <span className="text-stone-600">-</span>
              <span className="text-amber-400/40">1</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">Needs most attention</div>
          </div>
          <p className="text-stone-500 text-xs flex-1 leading-relaxed">
            Filter by RFM on the Segments page to prioritise — e.g. Flickerers with R=3+ are
            still recoverable; those with R=1 need a stronger incentive.
          </p>
        </div>
      </section>

      {/* ── Customer Journey ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-white font-bold text-base mb-1">Customer Journey</h2>
        <p className="text-stone-500 text-sm mb-5 leading-relaxed">
          Project Vision tracks each customer through a lifecycle loop. Actions are automatically
          triggered on upload based on segment and visit history, and logged with outcomes.
        </p>
        <div className="relative pl-6">
          {JOURNEY_STEPS.map(({ label, detail, color }, i) => (
            <div key={i} className="relative mb-4 last:mb-0">
              {/* vertical line */}
              {i < JOURNEY_STEPS.length - 1 && (
                <div className="absolute left-[-17px] top-5 bottom-[-12px] w-px bg-stone-800" />
              )}
              <div className={`absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-stone-950 ${color}`} />
              <p className="text-stone-200 text-sm font-semibold">{label}</p>
              <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Actions & Channels ────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-white font-bold text-base mb-1">Actions and Channels</h2>
        <p className="text-stone-500 text-sm mb-4 leading-relaxed">
          When a customer matches a trigger condition during upload, a recommended action is
          queued in their journey log. Actions are not sent automatically — they surface in
          the Actions page and on the customer profile for your review.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: 'WhatsApp', desc: 'Personalised message templates with the customer\'s name, favourite drink, and points balance resolved at upload time.' },
            { title: 'In-store', desc: 'Staff-facing prompts to recognise the customer at the counter — e.g. offer a loyalty reward or ask about their usual order.' },
            { title: 'Outcomes', desc: 'After an action is sent, mark it visited, redeemed, or no_response. Outcome data feeds back into future trigger decisions.' },
            { title: 'Journey log', desc: 'Every action and outcome is stored per customer. View the full history on any customer profile page.' },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <p className="text-stone-200 text-sm font-semibold mb-1">{title}</p>
              <p className="text-stone-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Time of Day filter ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-white font-bold text-base mb-1">Time of Day</h2>
        <p className="text-stone-500 text-sm leading-relaxed">
          Customers are profiled by their preferred ordering time slot — Morning (before noon),
          Afternoon (12pm–5pm), Evening (5pm–9pm), and Night (after 9pm) — derived from their
          order history. Use the Time of Day filter on the Segments page to target the right
          customers for a time-specific promotion (e.g. a morning discount for early regulars).
        </p>
      </section>
    </div>
  )
}
