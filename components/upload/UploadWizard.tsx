'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2, Users, Receipt, BookOpen } from 'lucide-react'
import { ingestCustomers, ingestTransactions, ingestRedemptionMenu, getUploadUrl } from '@/actions/ingest'
import type { UploadSummary } from '@/lib/types'
import type { CustomerUploadResult } from '@/actions/ingest'

async function uploadToStorage(file: File): Promise<string> {
  const { signedUrl, path } = await getUploadUrl(file.name)
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'x-upsert': 'true' },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Storage upload failed (${res.status}): ${msg}`)
  }
  return path
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
function DropZone({
  label, description, file, optional, onFile,
}: {
  label: string; description: string; file: File | null; optional?: boolean; onFile: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      className={`border rounded-xl p-4 cursor-pointer transition-colors ${
        file ? 'border-amber-500/50 bg-amber-500/5' : 'border-stone-700 bg-stone-900 hover:border-stone-600'
      }`}
    >
      <input ref={ref} type="file" accept=".csv,.tsv,.txt" className="hidden"
        onChange={e => onFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{label}</span>
            {optional && <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">optional</span>}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">{description}</p>
        </div>
        {file
          ? <div className="flex items-center gap-1.5 text-amber-400 text-xs"><CheckCircle size={14} />{file.name}</div>
          : <span className="text-xs text-stone-500">Click to upload</span>
        }
      </div>
    </div>
  )
}

// ─── Customer panel ───────────────────────────────────────────────────────────
function CustomerPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<CustomerUploadResult | null>(null)
  const [error, setError] = useState('')

  async function handleProcess() {
    if (!file) { setError('Please upload the customer file.'); return }
    setError(''); setProcessing(true)
    try {
      const path = await uploadToStorage(file)
      const r = await ingestCustomers(path)
      setResult(r)
    } catch (e) { setError(String(e)) }
    finally { setProcessing(false) }
  }

  function reset() { setResult(null); setFile(null); setError('') }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
          <Users size={16} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-bold">Customer File</h2>
          <p className="text-stone-400 text-xs">Lifetime customer base — upload whenever it&apos;s updated</p>
        </div>
      </div>

      {!result ? (
        <>
          <div className="mt-4 space-y-3">
            <DropZone
              label="Customers (CSV3)"
              description="crm_id, name, email, mobile, points balance"
              file={file}
              onFile={setFile}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2 mt-3">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <button
            onClick={handleProcess} disabled={processing || !file}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {processing ? <><Loader2 size={14} className="animate-spin" /> Updating customers...</> : <><Upload size={14} /> Update Customer Base</>}
          </button>
        </>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-3">
            <CheckCircle size={16} /> Customer base updated
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-stone-800 rounded-lg p-3 text-center">
              <div className="text-white text-xl font-bold">{result.totalProcessed}</div>
              <div className="text-stone-400 text-xs mt-0.5">Processed</div>
            </div>
            <div className="bg-stone-800 rounded-lg p-3 text-center">
              <div className="text-white text-xl font-bold">{result.newCustomers}</div>
              <div className="text-stone-400 text-xs mt-0.5">New customers</div>
            </div>
          </div>
          {result.errors.length > 0 && result.errors.map((e, i) => (
            <p key={i} className="text-red-400 text-xs mb-1">{e}</p>
          ))}
          <button onClick={reset} className="text-sm text-stone-400 hover:text-white transition-colors">
            Upload another →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Redemption menu panel ────────────────────────────────────────────────────
function RedemptionMenuPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function handleProcess() {
    if (!file) { setError('Please upload the redemption menu file.'); return }
    setError(''); setProcessing(true)
    try {
      const path = await uploadToStorage(file)
      const r = await ingestRedemptionMenu(path)
      if (r.error) setError(r.error)
      else setCount(r.count)
    } catch (e) { setError(String(e)) }
    finally { setProcessing(false) }
  }

  function reset() { setCount(null); setFile(null); setError('') }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
          <BookOpen size={16} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-white font-bold">Redemption Menu</h2>
          <p className="text-stone-400 text-xs">Points cost per drink — update whenever the menu changes</p>
        </div>
      </div>

      {count === null ? (
        <>
          <div className="mt-4">
            <DropZone label="Redemption Menu" description="item_code, item_name, points_required" file={file} onFile={setFile} />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2 mt-3">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <button
            onClick={handleProcess} disabled={processing || !file}
            className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {processing ? <><Loader2 size={14} className="animate-spin" /> Updating menu...</> : <><Upload size={14} /> Update Menu</>}
          </button>
        </>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-3">
            <CheckCircle size={16} /> Menu updated — {count} item{count !== 1 ? 's' : ''}
          </div>
          <button onClick={reset} className="text-sm text-stone-400 hover:text-white transition-colors">
            Upload another →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Transactions panel ───────────────────────────────────────────────────────
function TransactionsPanel() {
  const [csv1, setCsv1] = useState<File | null>(null)
  const [csv2, setCsv2] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<UploadSummary | null>(null)
  const [error, setError] = useState('')

  async function handleProcess() {
    if (!csv1 || !csv2) { setError('Both transaction files are required.'); return }
    setError(''); setProcessing(true)
    try {
      const [path1, path2] = await Promise.all([uploadToStorage(csv1), uploadToStorage(csv2)])
      const r = await ingestTransactions(path1, path2)
      setSummary(r)
    } catch (e) { setError(String(e)) }
    finally { setProcessing(false) }
  }

  function reset() { setSummary(null); setCsv1(null); setCsv2(null); setError('') }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center">
          <Receipt size={16} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-white font-bold">Daily Transactions</h2>
          <p className="text-stone-400 text-xs">Upload this pair every day — matches against your customer base</p>
        </div>
      </div>

      {!summary ? (
        <>
          <div className="mt-4 space-y-3">
            <DropZone label="Transactions (CSV1)" description="Bill headers — date, mobile, outlet, net sales" file={csv1} onFile={setCsv1} />
            <DropZone label="Line Items (CSV2)" description="Drink items + modifiers per bill" file={csv2} onFile={setCsv2} />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2 mt-3">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <button
            onClick={handleProcess} disabled={processing || !csv1 || !csv2}
            className="mt-4 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {processing ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Upload size={14} /> Process Transactions</>}
          </button>
        </>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-3">
            <CheckCircle size={16} /> Transactions processed
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: 'Customers updated', value: summary.totalProcessed },
              { label: 'Segment changes', value: summary.segmentChanges.length },
              { label: 'Actions generated', value: summary.actionsGenerated },
              { label: 'Unmatched txns', value: summary.errors.filter(e => e.includes('no matching')).length > 0 ? '⚠️' : '0' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-stone-800 rounded-lg p-3 text-center">
                <div className="text-white text-xl font-bold">{value}</div>
                <div className="text-stone-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {summary.segmentChanges.length > 0 && (
            <div className="mb-3">
              <p className="text-stone-400 text-xs font-semibold mb-1">SEGMENT CHANGES</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {summary.segmentChanges.map((c, i) => (
                  <div key={i} className="text-xs text-stone-300 flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-stone-500">{c.from ?? '—'} → {c.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.errors.length > 0 && summary.errors.map((e, i) => (
            <p key={i} className="text-red-400 text-xs mb-1">{e}</p>
          ))}
          <button onClick={reset} className="text-sm text-stone-400 hover:text-white transition-colors">
            Upload another batch →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export function UploadWizard() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-1">Upload</h1>
      <p className="text-stone-400 text-sm mb-6">
        Upload your customer base independently from daily transactions. They match automatically via mobile number.
      </p>
      <div className="space-y-4">
        <CustomerPanel />
        <TransactionsPanel />
        <RedemptionMenuPanel />
      </div>
    </div>
  )
}
