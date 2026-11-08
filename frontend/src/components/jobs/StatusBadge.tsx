import type { JobStatus } from '../../types/job'

const STYLES: Record<JobStatus, string> = {
  accepted: 'bg-slate-100 text-slate-700 ring-slate-300',
  processing: 'bg-blue-50 text-blue-700 ring-blue-300',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  needs_review: 'bg-amber-50 text-amber-800 ring-amber-300',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-300',
  failed: 'bg-red-50 text-red-700 ring-red-300',
}

const LABELS: Record<JobStatus, string> = {
  accepted: 'Accepted',
  processing: 'Processing',
  completed: 'Completed',
  needs_review: 'Needs review',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
}

/** `needs_review` (amber) is visually distinct from `failed` (red) by design. */
export default function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}

