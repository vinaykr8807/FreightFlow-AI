import { useCallback, useEffect, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/jobs/StatusBadge'
import { exportReportExcel, getRecords } from '../services/n8nClient'
import type { RecordListItem } from '../types/job'

const REQUEST_TYPES = [
  '',
  'booking_request',
  'tracking_request',
  'quotation_request',
  'documentation_request',
  'complaint',
  'other',
]

const STATUSES = ['', 'completed', 'needs_review', 'approved', 'rejected', 'failed']
const PAGE_SIZE = 20

export default function ReportsPage() {
  const [requestType, setRequestType] = useState('')
  const [status, setStatus] = useState('')
  const [reviewRequired, setReviewRequired] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)

  const [items, setItems] = useState<RecordListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildFilterParams = useCallback(() => {
    const p: Record<string, string> = {}
    if (requestType) p.request_type = requestType
    if (status) p.status = status
    if (reviewRequired) p.review_required = reviewRequired
    if (search.trim()) p.search = search.trim()
    if (dateFrom) p.date_from = `${dateFrom}T00:00:00Z`
    if (dateTo) p.date_to = `${dateTo}T23:59:59Z`
    return p
  }, [requestType, status, reviewRequired, search, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRecords({ ...buildFilterParams(), limit: PAGE_SIZE, offset })
      setItems(res.items)
      setTotal(res.total)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load records')
    } finally {
      setLoading(false)
    }
  }, [buildFilterParams, offset])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const blob = await exportReportExcel(buildFilterParams())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.download = `freightflow_report_${ts}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel export failed')
    } finally {
      setExporting(false)
    }
  }

  const input =
    'mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-slate-600">
            Filter processed freight emails and export an operational Excel report (excludes raw email bodies).
          </p>
        </div>
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export Excel (.xlsx)'}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs font-medium text-slate-600">
          Request type
          <select
            value={requestType}
            onChange={(e) => {
              setOffset(0)
              setRequestType(e.target.value)
            }}
            className={input}
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t ? t.replace('_', ' ') : 'All types'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Status
          <select
            value={status}
            onChange={(e) => {
              setOffset(0)
              setStatus(e.target.value)
            }}
            className={input}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace('_', ' ') : 'All statuses'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Review required
          <select
            value={reviewRequired}
            onChange={(e) => {
              setOffset(0)
              setReviewRequired(e.target.value)
            }}
            className={input}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          From date
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setOffset(0)
              setDateFrom(e.target.value)
            }}
            className={input}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To date
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setOffset(0)
              setDateTo(e.target.value)
            }}
            className={input}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Search
          <div className="relative">
            <input
              value={search}
              onChange={(e) => {
                setOffset(0)
                setSearch(e.target.value)
              }}
              placeholder="Job, customer, port…"
              className={`${input} pl-7`}
            />
            <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'} matching filters`}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No records match the active filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 font-medium">Job</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Route</th>
                  <th className="pb-2 font-medium">Container / Ref</th>
                  <th className="pb-2 font-medium">ETD</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => (
                  <tr key={r.record_id}>
                    <td className="py-2 pr-3">
                      <Link
                        to={`/jobs/${encodeURIComponent(r.job_id)}`}
                        className="font-mono text-xs text-indigo-600 hover:underline"
                      >
                        {r.job_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{r.extracted.customer_name ?? '—'}</td>
                    <td className="py-2 pr-3">{r.request_type.replace('_', ' ')}</td>
                    <td className="py-2 pr-3">
                      {[r.extracted.origin, r.extracted.destination].filter(Boolean).join(' → ') || '—'}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.extracted.container_number ?? r.extracted.shipment_reference ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs">{r.extracted.etd ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

