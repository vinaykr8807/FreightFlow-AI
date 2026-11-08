import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { useDashboardWebSocket } from '../hooks/useDashboardWebSocket'
import { getMetrics, N8N_BASE_URL, WS_URL } from '../services/n8nClient'

export default function SettingsPage() {
  const [n8nOk, setN8nOk] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const wsState = useDashboardWebSocket({
    onEvent: () => {
      /* connection status probe */
    },
  })

  const checkConnections = async () => {
    setChecking(true)
    try {
      await getMetrics()
      setN8nOk(true)
    } catch {
      setN8nOk(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    void checkConnections()
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Settings & Connection Status</h2>
          <p className="text-sm text-slate-600">
            Non-secret public browser configuration and live connectivity checks. API keys remain strictly on the server.
          </p>
        </div>
        <button
          onClick={() => void checkConnections()}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          Re-test
        </button>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Service health</h3>
        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-3">
            <div>
              <dt className="font-medium text-slate-800">n8n Workflow Webhooks → FastAPI</dt>
              <dd className="text-xs text-slate-500">
                <code>{N8N_BASE_URL}/webhook/freight/*</code>
              </dd>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              {n8nOk === null ? (
                <span className="text-slate-500">Checking…</span>
              ) : n8nOk ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-700">
                  <XCircle className="h-4 w-4" /> Unreachable
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <dt className="font-medium text-slate-800">FastAPI WebSocket Gateway</dt>
              <dd className="text-xs text-slate-500">
                <code>{WS_URL}/ws/dashboard</code> &amp; <code>/ws/jobs/&#123;job_id&#125;</code>
              </dd>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              {wsState === 'open' ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Live ({wsState})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <XCircle className="h-4 w-4" /> {wsState}
                </span>
              )}
            </span>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Architecture & security boundaries</h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            <strong>LLM Model:</strong> Groq <code>openai/gpt-oss-120b</code> (called only by FastAPI, never from the browser).
          </li>
          <li>
            <strong>Workflow Orchestration:</strong> n8n handles public webhooks, idempotency checks, PDF routing, and review decisions.
          </li>
          <li>
            <strong>Document limits:</strong> Digital PDFs up to 10 MB / 20 pages; scanned/image-only PDFs are routed to human review.
          </li>
          <li>
            <strong>Safety policy:</strong> MVP does not automatically confirm bookings, quote prices, update external TMS systems, or send customer emails.
          </li>
        </ul>
      </section>
    </div>
  )
}

