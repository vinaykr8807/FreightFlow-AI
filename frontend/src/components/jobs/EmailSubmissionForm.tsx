import { useRef, useState, type FormEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import rawSamples from '../../../../samples/emails/labelled_emails.json'

export interface EmailFormValues {
  sender: string
  subject: string
  body: string
  file: File | null
}

interface SampleEmail {
  email_id: string
  sender: string
  subject: string
  body: string
  notes: string
  expected: {
    request_type: string
    review_required: boolean
  }
}

const SAMPLE_EMAILS: SampleEmail[] = rawSamples as SampleEmail[]

const MAX_MB = 10

const SAMPLE = {
  sender: SAMPLE_EMAILS[0].sender,
  subject: SAMPLE_EMAILS[0].subject,
  body: SAMPLE_EMAILS[0].body,
}

interface Props {
  disabled: boolean
  submitting: boolean
  onSubmit: (v: EmailFormValues) => void
}

export default function EmailSubmissionForm({ disabled, submitting, onSubmit }: Props) {
  const [values, setValues] = useState({ sender: '', subject: '', body: '' })
  const [selectedSampleId, setSelectedSampleId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: 'sender' | 'subject' | 'body') => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }))
  const valid = values.body.trim().length > 0 && !fileError

  const selectSample = (emailId: string) => {
    setSelectedSampleId(emailId)
    const found = SAMPLE_EMAILS.find((s) => s.email_id === emailId)
    if (found) {
      setValues({
        sender: found.sender,
        subject: found.subject,
        body: found.body,
      })
    }
  }

  const selectedSample = SAMPLE_EMAILS.find((s) => s.email_id === selectedSampleId)

  const pickFile = (f: File | null) => {
    setFileError(null)
    if (!f) {
      setFile(null)
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`PDF must be ${MAX_MB} MB or smaller.`)
      setFile(null)
      return
    }
    setFile(f)
  }

  const clearFile = () => {
    setFile(null)
    setFileError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handle = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !disabled) onSubmit({ ...values, file })
  }

  const input =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100'

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="sample-email-select" className="text-xs font-medium text-slate-700">
            Load sample scenario ({SAMPLE_EMAILS.length} labelled emails from <code className="text-slate-600">samples/emails/labelled_emails.json</code>)
          </label>
          <button
            type="button"
            onClick={() => {
              setSelectedSampleId(SAMPLE_EMAILS[0].email_id)
              setValues(SAMPLE)
            }}
            disabled={disabled}
            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            Fill demo email
          </button>
        </div>
        <select
          id="sample-email-select"
          value={selectedSampleId}
          onChange={(e) => selectSample(e.target.value)}
          disabled={disabled}
          className="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
        >
          <option value="">-- Choose a sample email scenario --</option>
          {SAMPLE_EMAILS.map((s) => (
            <option key={s.email_id} value={s.email_id}>
              {s.email_id} [{s.expected.request_type} · {s.expected.review_required ? 'Needs Review' : 'Auto-Complete'}] — {s.subject}
            </option>
          ))}
        </select>
        {selectedSample && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
              Expected Category: {selectedSample.expected.request_type}
            </span>
            <span
              className={`rounded px-2 py-0.5 font-medium ${
                selectedSample.expected.review_required
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Expected Routing: {selectedSample.expected.review_required ? 'Human Review Queue' : 'Straight-Through Completed'}
            </span>
            {selectedSample.notes && <span className="text-slate-500">Note: {selectedSample.notes}</span>}
          </div>
        )}
      </div>
      <label className="block text-sm font-medium text-slate-700">
        From
        <input
          type="email"
          value={values.sender}
          onChange={set('sender')}
          disabled={disabled}
          placeholder="customer@example.com"
          maxLength={320}
          className={input}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Subject
        <input value={values.subject} onChange={set('subject')} disabled={disabled} maxLength={500} className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Body
        <textarea
          value={values.body}
          onChange={set('body')}
          disabled={disabled}
          rows={9}
          maxLength={50000}
          required
          className={input}
        />
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          PDF attachment <span className="font-normal text-slate-400">(optional, digital PDFs up to {MAX_MB} MB)</span>
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          {file && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
              <Paperclip className="h-3 w-3" />
              {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              <button type="button" onClick={clearFile} aria-label="Remove file" className="text-slate-500 hover:text-slate-800">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
        <p className="mt-1 text-xs text-slate-400">
          Scanned/image-only PDFs are detected and routed to human review.
        </p>
      </div>
      <button
        type="submit"
        disabled={!valid || disabled}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {submitting ? 'Submitting…' : 'Process email'}
      </button>
    </form>
  )
}
