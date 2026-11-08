import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import ClassificationChart from '../components/dashboard/ClassificationChart'
import MetricCard from '../components/dashboard/MetricCard'
import StatusBadge from '../components/jobs/StatusBadge'
import { useDashboardWebSocket } from '../hooks/useDashboardWebSocket'
import { getMetrics, getRecords } from '../services/n8nClient'
import type { JobEvent } from '../types/events'
import type { Metrics, RecordListItem } from '../types/job'

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recent, setRecent] = useState<RecordListItem[]>([])
  const [feed, setFeed] = useState<JobEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([getMetrics(), getRecords({ limit: 8 })])
      setMetrics(m)
      setRecent(r.items)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard data')
    }
  }, [])

  // Debounced so a burst of events (one job emits ~7) causes a single re-read.
  const scheduleLoad = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), 400)
  }, [load])

  const socket = useDashboardWebSocket({
    onEvent: (e) => {
      setFeed((cur) => [e, ...cur].slice(0, 30))
      scheduleLoad()
    },
    onOpen: () => void load(),
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => clearTimeout(timer.current)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-600">Computed from stored jobs, not sample counters.</p>
        </div>
        <span className={`text-xs ${socket === 'open' ? 'text-emerald-600' : 'text-slate-500'}`}>
          {socket === 'open' ? '● Live' : '○ Not live'}
          <button onClick={() => void load()} className="ml-3 text-indigo-600 hover:underline">
            Refresh
          </button>
        </span>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Total jobs" value={metrics?.total_jobs ?? '—'} />
        <MetricCard label="Completed, no review" value={metrics?.completed_without_review ?? '—'} tone="green" />
        <MetricCard label="Awaiting review" value={metrics?.awaiting_review ?? '—'} tone="amber" />
        <MetricCard label="Failed" value={metrics?.failed ?? '—'} tone="red" />
        <MetricCard
          label="Straight-through rate"
          value={pct(metrics?.straight_through_rate ?? null)}
          hint="Processed with no human review. Not AI accuracy."
        />
        <MetricCard label="Human-review rate" value={pct(metrics?.human_review_rate ?? null)} />
        <MetricCard
          label="Avg processing time"
          value={metrics?.avg_processing_seconds != null ? `${metrics.avg_processing_seconds}s` : '—'}
        />
        <MetricCard label="Duplicates caught" value={metrics?.duplicate_submissions ?? '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Requests by type</h3>
          <ClassificationChart breakdown={metrics?.classification_breakdown ?? {}} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Live activity</h3>
          <ActivityFeed events={feed} />
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent jobs</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No processed jobs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Job</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Route</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.record_id}>
                  <td className="py-2">
                    <Link to={`/jobs/${encodeURIComponent(r.job_id)}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.job_id}
                    </Link>
                  </td>
                  <td className="py-2">{r.extracted.customer_name ?? '—'}</td>
                  <td className="py-2">{[r.extracted.origin, r.extracted.destination].filter(Boolean).join(' → ') || '—'}</td>
                  <td className="py-2">{r.request_type.replace('_', ' ')}</td>
                  <td className="py-2">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

