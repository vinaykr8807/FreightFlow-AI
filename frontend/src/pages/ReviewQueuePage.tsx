import { useCallback, useEffect, useState } from 'react'
import ReviewDecisionForm from '../components/review/ReviewDecisionForm'
import ReviewTable from '../components/review/ReviewTable'
import { useDashboardWebSocket } from '../hooks/useDashboardWebSocket'
import { getReviewQueue } from '../services/n8nClient'
import type { ReviewQueueItem } from '../types/job'

const QUEUE_EVENTS = new Set(['review.required', 'review.approved', 'review.rejected'])

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await getReviewQueue())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the review queue')
    } finally {
      setLoaded(true)
    }
  }, [])

  // The queue comes from durable state; the socket only tells us when to re-read it.
  const socket = useDashboardWebSocket({
    onEvent: (e) => {
      if (QUEUE_EVENTS.has(e.event)) void load()
    },
    onOpen: () => void load(),
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const current = items.find((i) => i.record_id === selected) ?? items[0] ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Review queue</h2>
          <p className="text-sm text-slate-600">
            Records the system was not confident about. Correct, approve or reject. Needs review is not a failure.
          </p>
        </div>
        <span className={`text-xs ${socket === 'open' ? 'text-emerald-600' : 'text-slate-500'}`}>
          {socket === 'open' ? '● Live' : '○ Not live, use refresh'}
          <button onClick={() => void load()} className="ml-3 text-indigo-600 hover:underline">
            Refresh
          </button>
        </span>
      </header>

      {flash && (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {flash}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loaded && !error && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nothing is waiting for review.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{items.length} waiting</p>
            <ReviewTable items={items} selectedId={current?.record_id ?? null} onSelect={setSelected} />
          </div>
          {current && (
            <ReviewDecisionForm
              key={current.record_id}
              item={current}
              onDecided={(msg) => {
                setFlash(msg)
                setSelected(null)
                void load()
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

