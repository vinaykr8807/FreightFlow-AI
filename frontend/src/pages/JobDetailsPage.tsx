import { useParams } from 'react-router-dom'
import JobView from '../components/jobs/JobView'
import { useJobStream } from '../hooks/useJobStream'

export default function JobDetailsPage() {
  const { jobId = '' } = useParams()
  // Opened from a link or after a refresh: fetch durable state immediately, then stay live.
  const stream = useJobStream(jobId || null, true)
  const notFound = stream.job === null && stream.error === null && stream.events.length === 0

  return (
    <div className="mx-auto max-w-5xl">
      <JobView stream={stream} jobId={jobId} />
      {notFound && stream.socket === 'open' && (
        <p className="mt-4 text-xs text-slate-500">
          If this job does not exist yet, details will appear as soon as it is submitted.
        </p>
      )}
    </div>
  )
}

