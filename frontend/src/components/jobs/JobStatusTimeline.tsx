import { CheckCircle2, Circle, AlertTriangle, XCircle } from 'lucide-react'
import type { JobEvent } from '../../types/events'

function iconFor(event: string) {
  if (event === 'job.failed') return <XCircle className="h-4 w-4 text-red-600" />
  if (event === 'review.required' || event === 'job.duplicate')
    return <AlertTriangle className="h-4 w-4 text-amber-600" />
  if (event === 'review.rejected') return <XCircle className="h-4 w-4 text-rose-600" />
  if (event.endsWith('started') || event === 'job.processing' || event === 'job.accepted')
    return <Circle className="h-4 w-4 text-slate-400" />
  return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
}

export default function JobStatusTimeline({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No events yet.</p>
  }
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.event_id} className="flex items-start gap-3">
          <span className="mt-0.5">{iconFor(e.event)}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{e.message}</p>
            <p className="text-xs text-slate-500">
              <code>{e.event}</code> · {new Date(e.timestamp).toLocaleTimeString()}
            </p>
            {Array.isArray(e.data?.reasons) && (
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                {(e.data.reasons as string[]).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

