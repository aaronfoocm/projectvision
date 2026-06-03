'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { ingestCsvs, ingestRedemptionMenu } from '@/actions/ingest'
import type { UploadSummary } from '@/lib/types'

interface FileSlot {
  key: string
  label: string
  description: string
  required: boolean
  file: File | null
}

export function UploadWizard() {
  const [slots, setSlots] = useState<FileSlot[]>([
    { key: 'csv1', label: 'Transactions', description: 'Bill headers — Date, Mobile, Outlet, Net Sales', required: true, file: null },
    { key: 'csv2', label: 'Line Items', description: 'Drink items + modifiers per bill', required: true, file: null },
    { key: 'csv3', label: 'Customers', description: 'CRM records — crm_id, email, points balance', required: true, file: null },
    { key: 'redemption_menu', label: 'Redemption Menu', description: 'item_code, item_name, points_required (update when menu changes)', required: false, file: null },
  ])
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<UploadSummary | null>(null)
  const [error, setError] = useState('')

  function setFile(key: string, file: File | null) {
    setSlots(prev => prev.map(s => s.key === key ? { ...s, file } : s))
  }

  async function handleProcess() {
    const missing = slots.filter(s => s.required && !s.file)
    if (missing.length) { setError(`Please upload: ${missing.map(s => s.label).join(', ')}`); return }
    setError('')
    setProcessing(true)
    try {
      const menuSlot = slots.find(s => s.key === 'redemption_menu')
      if (menuSlot?.file) {
        const menuFd = new FormData()
        menuFd.append('redemption_menu', menuSlot.file)
        await ingestRedemptionMenu(menuFd)
      }
      const fd = new FormData()
      for (const slot of slots.filter(s => s.key !== 'redemption_menu')) {
        if (slot.file) fd.append(slot.key, slot.file)
      }
      const result = await ingestCsvs(fd)
      setSummary(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setSummary(null)
    setSlots(prev => prev.map(s => ({ ...s, file: null })))
    setError('')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-1">Upload CSVs</h1>
      <p className="text-stone-400 text-sm mb-8">
        Upload your 3 daily exports to re-segment customers and generate today's actions.
      </p>

      <div className="space-y-3 mb-6">
        {slots.map(slot => (
          <DropZone key={slot.key} slot={slot} onFile={f => setFile(slot.key, f)} />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!summary && (
        <button
          onClick={handleProcess}
          disabled={processing}
          className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {processing
            ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
            : <><Upload size={15} /> Process & Segment</>}
        </button>
      )}

      {summary && <SummaryView summary={summary} onReset={reset} />}
    </div>
  )
}

function DropZone({ slot, onFile }: { slot: FileSlot; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      className={`border rounded-xl p-4 cursor-pointer transition-colors ${
        slot.file
          ? 'border-amber-500/50 bg-amber-500/5'
          : 'border-stone-700 bg-stone-900 hover:border-stone-600'
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{slot.label}</span>
            {!slot.required && (
              <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">optional</span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">{slot.description}</p>
        </div>
        {slot.file
          ? <div className="flex items-center gap-1.5 text-amber-400 text-xs"><CheckCircle size={14} />{slot.file.name}</div>
          : <span className="text-xs text-stone-500">Click to upload</span>
        }
      </div>
    </div>
  )
}

function SummaryView({ summary, onReset }: { summary: UploadSummary; onReset: () => void }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
      <div className="flex items-center gap-2 text-green-400 font-semibold mb-4">
        <CheckCircle size={18} /> Upload complete
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Customers processed', value: summary.totalProcessed },
          { label: 'New customers', value: summary.newCustomers },
          { label: 'Segment changes', value: summary.segmentChanges.length },
          { label: 'Actions generated', value: summary.actionsGenerated },
        ].map(({ label, value }) => (
          <div key={label} className="bg-stone-800 rounded-lg p-3">
            <div className="text-white text-xl font-bold">{value}</div>
            <div className="text-stone-400 text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {summary.segmentChanges.length > 0 && (
        <div className="mb-4">
          <p className="text-stone-400 text-xs font-semibold mb-2">SEGMENT CHANGES</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {summary.segmentChanges.map((c, i) => (
              <div key={i} className="text-xs text-stone-300 flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-stone-500">{c.from ?? '—'} → {c.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.errors.length > 0 && (
        <div className="mb-4">
          <p className="text-red-400 text-xs font-semibold mb-1">WARNINGS</p>
          {summary.errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
        </div>
      )}

      <button onClick={onReset} className="text-sm text-stone-400 hover:text-white transition-colors">
        Upload another batch →
      </button>
    </div>
  )
}
