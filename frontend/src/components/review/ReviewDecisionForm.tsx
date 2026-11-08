import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { submitReview } from '../../services/n8nClient'
import type { Extraction, ReviewQueueItem } from '../../types/job'

const REQUEST_TYPES = [
  'booking_request',
  'tracking_request',
  'quotation_request',
  'documentation_request',
  'complaint',
  'other',
]

const TEXT_FIELDS: [keyof Extraction, string, string?][] = [
  ['customer_name', 'Customer'],
  ['origin', 'Origin'],
  ['destination', 'Destination'],
  ['cargo_description', 'Cargo description'],
  ['container_number', 'Container number', '4 letters + 7 digits, e.g. TEST1234567'],
  ['shipment_reference', 'Shipment reference'],
  ['etd', 'ETD', 'YYYY-MM-DD'],
  ['eta', 'ETA', 'YYYY-MM-DD'],
]

type Draft = Record<keyof Extraction, string>

const toDraft = (x: Extraction): Draft =>
  Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v ?? ''])) as Draft

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CONTAINER = /^[A-Z]{4}\d{7}$/

/** Light client-side hints. The server re-validates the corrected record. */
function hints(d: Draft): string[] {
  const out: string[] = []
  const need = (k: keyof Extraction, label: string) => !d[k].trim() && out.push(`${label} is still empty`)
  if (d.request_type === 'booking_request') {
    need('origin', 'Origin')
    need('destination', 'Destination')
    need('cargo_description', 'Cargo description')
  }
  if (d.request_type === 'quotation_request') {
    need('origin', 'Origin')
    need('destination', 'Destination')
  }
  if (d.request_type === 'tracking_request' && !d.shipment_reference.trim() && !d.container_number.trim())
    out.push('Tracking needs a shipment reference or container number')
  if (d.container_number.trim() && !CONTAINER.test(d.container_number.trim().toUpperCase()))
    out.push('Container number has an invalid format')
  for (const k of ['etd', 'eta'] as const)
    if (d[k].trim() && !ISO_DATE.test(d[k].trim())) out.push(`${k.toUpperCase()} must be YYYY-MM-DD`)
  return out
}

interface Props {
  item: ReviewQueueItem
  onDecided: (message: string) => void
}

export default function ReviewDecisionForm({ item, onDecided }: Props) {
  const original = toDraft(item.extracted)
  const [draft, setDraft] = useState<Draft>(original)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const corrections: Partial<Extraction> = {}
  for (const k of Object.keys(original) as (keyof Extraction)[]) {
    if (k === 'summary') continue
    if (draft[k].trim() !== original[k].trim()) (corrections as Record<string, string | null>)[k] = draft[k].trim() || null
  }
  const changed = Object.keys(corrections).length
  const warnings = hints(draft)

  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !note.trim()) {
      setError('A reason is required to reject a record.')
      return
    }
    setBusy(decision)
    setError(null)
    try {
      await submitReview({
        record_id: item.record_id,
        job_id: item.job_id,
        decision,
        // Rejections keep the original extraction untouched; only approvals carry corrections.
        corrections: decision === 'approved' ? corrections : {},
        review_note: note.trim() || null,
      })
      onDecided(decision === 'approved' ? 'Record approved.' : 'Record rejected.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the decision')
      setBusy(null)
    }
  }

  const input =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Review record</h3>
        <Link to={`/jobs/${encodeURIComponent(item.job_id)}`} className="text-xs text-indigo-600 hover:underline">
          Open job {item.job_id}
        </Link>
      </div>

      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-medium text-amber-900">Why this was flagged</p>
        <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
          {item.validation.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        The original email text is not stored by the MVP, so check values against your source email. Approval means
        the data is verified for this demo. It does not book or change anything.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Request type
          <select
            value={draft.request_type}
            onChange={(e) => setDraft((d) => ({ ...d, request_type: e.target.value }))}
            className={input}
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        {TEXT_FIELDS.map(([key, label, placeholder]) => (
          <label key={key} className="text-sm font-medium text-slate-700">
            {label}
            {item.validation.missing_fields.includes(key) && <span className="ml-1 text-xs text-amber-700">(missing)</span>}
            <input
              value={draft[key]}
              placeholder={placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              className={`${input} ${key in corrections ? 'border-indigo-400 bg-indigo-50' : ''}`}
            />
          </label>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-amber-700">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Reviewer note <span className="font-normal text-slate-400">(required to reject)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={input} />
      </label>

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void decide('approved')}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {busy === 'approved' ? 'Saving…' : changed ? `Approve with ${changed} correction${changed > 1 ? 's' : ''}` : 'Approve'}
        </button>
        <button
          onClick={() => void decide('rejected')}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {busy === 'rejected' ? 'Saving…' : 'Reject'}
        </button>
      </div>
    </section>
  )
}

