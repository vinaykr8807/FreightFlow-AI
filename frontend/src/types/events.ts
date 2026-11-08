export interface JobEvent {
  event_id: string
  job_id: string
  event: string
  message: string
  timestamp: string
  data: Record<string, unknown>
}

/** Events after which the durable job state should be re-fetched. */
export const TERMINAL_EVENTS = new Set([
  'job.completed',
  'review.required',
  'job.failed',
  'review.approved',
  'review.rejected',
])

