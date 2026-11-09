import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, FileSpreadsheet, Mail, RefreshCw } from 'lucide-react'
import JobView from '../components/jobs/JobView'
import { useJobStream } from '../hooks/useJobStream'

export default function JobDetailsPage() {
  const { jobId = '' } = useParams()
  // Opened from a link or after a refresh: fetch durable state immediately, then stay live.
  const stream = useJobStream(jobId || null, true)
  const notFound = stream.job === null && stream.error === null && stream.events.length === 0
  const job = stream.job

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <Link
          to="/process"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Process Email
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {job?.status === 'needs_review' && (
            <Link
              to="/review"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Resolve in Review Queue
            </Link>
          )}

          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            View in Reports
          </Link>

          <button
            type="button"
            onClick={() => void stream.refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Job View (Progress Timeline + Extracted Fields) */}
      <JobView stream={stream} jobId={jobId} showOpenDetailsLink={false} />

      {/* Metadata & Audit Information */}
      {job && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Durable Audit Metadata</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3 text-xs">
            <div>
              <dt className="uppercase tracking-wide text-slate-500">Source</dt>
              <dd className="mt-1 font-mono text-slate-800">{job.source}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-500">Email Identifier</dt>
              <dd className="mt-1 font-mono text-slate-800">{job.email_id}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-500">Created At</dt>
              <dd className="mt-1 text-slate-800">{new Date(job.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-500">Updated At</dt>
              <dd className="mt-1 text-slate-800">{new Date(job.updated_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-500">Review Required Flag</dt>
              <dd className="mt-1">
                {job.record?.review_required ? (
                  <span className="font-semibold text-amber-700">Yes (Requires Human Review)</span>
                ) : (
                  <span className="font-semibold text-emerald-700">No (Straight-Through Processed)</span>
                )}
              </dd>
            </div>
            {job.record?.record_id && (
              <div>
                <dt className="uppercase tracking-wide text-slate-500">Record ID</dt>
                <dd className="mt-1 font-mono text-slate-800">{job.record.record_id}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {notFound && stream.socket === 'open' && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-2 text-sm font-semibold text-slate-700">Job Not Found</h3>
          <p className="mt-1 text-xs text-slate-500">
            No record found for <code className="font-mono text-slate-700">{jobId}</code>. If this job is currently
            being submitted, details will appear automatically once processed.
          </p>
          <div className="mt-4">
            <Link
              to="/process"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              Submit an email
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}


