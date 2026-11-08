import { Link } from 'react-router-dom'
import type { JobEvent } from '../../types/events'

/** Live-only feed (not persisted): shows activity since this page was opened. */
export default function ActivityFeed({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Waiting for activity. New jobs from any source appear here.</p>
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {events.map((e) => (
        <li key={e.event_id} className="text-sm">
          <span className="text-xs text-slate-400">{new Date(e.timestamp).toLocaleTimeString()} </span>
          <Link to={`/jobs/${encodeURIComponent(e.job_id)}`} className="font-mono text-xs text-indigo-600 hover:underline">
            {e.job_id}
          </Link>
          <span className="text-slate-700"> {e.message}</span>
        </li>
      ))}
    </ul>
  )
}

