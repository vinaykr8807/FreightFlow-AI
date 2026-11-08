import { AlertTriangle } from 'lucide-react'
import type { ReviewQueueItem } from '../../types/job'

interface Props {
  items: ReviewQueueItem[]
  selectedId: string | null
  onSelect: (recordId: string) => void
}

export default function ReviewTable({ items, selectedId, onSelect }: Props) {
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {items.map((it) => {
        const active = it.record_id === selectedId
        const route =
          [it.extracted.origin, it.extracted.destination].filter(Boolean).join(' → ') || 'No route extracted'
        return (
          <li key={it.record_id}>
            <button
              onClick={() => onSelect(it.record_id)}
              aria-current={active}
              className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${active ? 'bg-indigo-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">
                  {it.extracted.customer_name ?? 'Unknown customer'}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{new Date(it.created_at).toLocaleTimeString()}</span>
              </div>
              <p className="truncate text-xs text-slate-600">{route}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate">{it.validation.reasons[0] ?? 'Flagged'}</span>
                {it.validation.reasons.length > 1 && <span>+{it.validation.reasons.length - 1}</span>}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                <code>{it.job_id}</code> · {it.request_type.replace('_', ' ')}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

