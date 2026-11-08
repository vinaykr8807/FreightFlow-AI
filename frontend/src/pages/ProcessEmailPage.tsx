import { useState } from 'react'
import EmailSubmissionForm, { type EmailFormValues } from '../components/jobs/EmailSubmissionForm'
import JobView from '../components/jobs/JobView'
import { useJobStream } from '../hooks/useJobStream'
import { submitEmail } from '../services/n8nClient'

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10)

export default function ProcessEmailPage() {
  // The job id is created up front so the WebSocket is connected BEFORE the submit,
  // which means no early events are missed.
  const [jobId, setJobId] = useState(() => `job-${newId()}`)
  const [emailId, setEmailId] = useState(() => `DASH-${newId()}`)
  const [started, setStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const stream = useJobStream(jobId, started)

  const handleSubmit = async (v: EmailFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Same job_id/email_id on a retry => n8n/FastAPI treat it as a duplicate, not a second job.
      await submitEmail({
        job_id: jobId,
        email_id: emailId,
        source: 'dashboard',
        sender: v.sender,
        subject: v.subject,
        body: v.body,
        received_at: new Date().toISOString(),
        file: v.file,
      })
      setStarted(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setJobId(`job-${newId()}`)
    setEmailId(`DASH-${newId()}`)
    setStarted(false)
    setSubmitError(null)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h2 className="text-xl font-semibold">Process email</h2>
        <p className="text-sm text-slate-600">
          Submit a freight email. Extraction runs through n8n; progress streams back live. Nothing is booked or sent.
        </p>
      </header>

      {!started ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          {submitError && (
            <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {submitError}
            </div>
          )}
          <EmailSubmissionForm
            disabled={submitting || stream.socket !== 'open'}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
          {stream.socket !== 'open' && (
            <p className="mt-3 text-xs text-slate-500">Waiting for the live connection before enabling submit…</p>
          )}
        </section>
      ) : (
        <>
          <JobView stream={stream} jobId={jobId} />
          <button onClick={reset} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Process another email
          </button>
        </>
      )}
    </div>
  )
}

