import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import JobStatusTimeline from './JobStatusTimeline'
import ExtractedFields from './ExtractedFields'
import type { JobStream } from '../../hooks/useJobStream'

const SOCKET_LABEL = {
  connecting: 'Connecting…',
  open: 'Live',
  reconnecting: 'Reconnecting…',
  closed: 'Offline',
} as const

/** Shared job view used by both the submit page and the job-details page. */
export default function JobView({
  stream,
  jobId,
  showOpenDetailsLink = true,
}: {
  stream: JobStream
  jobId: string
  showOpenDetailsLink?: boolean
}) {
  const { job, events, socket, error } = stream
  const live = socket === 'open'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          Job <code className="text-base text-slate-800">{jobId}</code>
        </h2>
        {job && <StatusBadge status={job.status} />}
        <span className={`inline-flex items-center gap-1.5 text-xs ${live ? 'text-emerald-600' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {SOCKET_LABEL[socket]}
        </span>
        {showOpenDetailsLink && (
          <Link
            to={`/jobs/${encodeURIComponent(jobId)}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Open dedicated job page →
          </Link>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {job?.status === 'failed' && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Processing failed ({job.error_code ?? 'unknown'}). No record was saved.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Progress</h3>
          <JobStatusTimeline events={events} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Extracted information</h3>
          {job?.record ? (
            <ExtractedFields record={job.record} />
          ) : (
            <p className="text-sm text-slate-500">
              {job?.status === 'failed' ? 'Nothing extracted.' : 'Waiting for extraction…'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
