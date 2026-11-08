import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  ShieldAlert,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { getMetrics } from '../services/n8nClient'
import type { Metrics } from '../types/job'

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'n8n Webhook Ingestion',
    subtitle: 'POST /webhook/freight/process',
    description:
      'Accepts freight emails and multipart PDF shipping documents, enforces idempotency on (source, email_id), and returns HTTP 202 Accepted immediately.',
    icon: Workflow,
    badge: 'n8n Docker',
  },
  {
    step: '02',
    title: '4-View PyMuPDF Document Parser',
    subtitle: 'Spatial + Layout + Tables + AcroForm',
    description:
      'Extracts multi-column Bills of Lading, ruled tables, and interactive PDF form widgets while automatically flagging scanned or unreadable attachments.',
    icon: FileText,
    badge: 'PyMuPDF',
  },
  {
    step: '03',
    title: 'Zero-Temp LLM Extraction',
    subtitle: 'Groq (openai/gpt-oss-120b)',
    description:
      'Classifies emails into 6 logistics categories and extracts 10 structured shipment fields using strict JSON schema validation and untrusted-tag isolation.',
    icon: Cpu,
    badge: 'Groq AI',
  },
  {
    step: '04',
    title: 'Deterministic Business Rules',
    subtitle: 'Python Validator Engine',
    description:
      'Verifies required category fields, ISO 6346 container numbers (4 letters + 7 digits), ISO dates, and origin/destination consistency.',
    icon: ShieldAlert,
    badge: 'FastAPI',
  },
  {
    step: '05',
    title: 'HITL Review & Excel Reporting',
    subtitle: 'WebSockets + Multi-Sheet .xlsx',
    description:
      'Streams live stage events to the browser, routes flagged records to human operators for approval/rejection, and exports multi-tab operational workbooks.',
    icon: ClipboardCheck,
    badge: 'SQLite + OpenPyXL',
  },
]

const WORKSPACE_MODULES = [
  {
    title: 'Operations Dashboard',
    description: 'Live KPIs, straight-through vs. review rates, request classification breakdown chart, and real-time WebSocket activity stream.',
    to: '/dashboard',
    icon: LayoutDashboard,
    cta: 'Open Dashboard',
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    title: 'Process Freight Email',
    description: 'Test with 32 pre-labelled freight email scenarios or upload complex Bills of Lading PDFs and watch stage-by-stage extraction live.',
    to: '/process',
    icon: Mail,
    cta: 'Submit Email / PDF',
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    title: 'Human Review Queue',
    description: 'Inspect records flagged for missing fields, invalid container IDs, complaints, or unreadable PDFs. Edit values and approve or reject.',
    to: '/review',
    icon: ClipboardCheck,
    cta: 'Review Flagged Jobs',
    accent: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    title: 'Operational Reports (.xlsx)',
    description: 'Filter processed records by category, review status, or date range and export a 3-sheet Excel workbook for downstream teams.',
    to: '/reports',
    icon: FileSpreadsheet,
    cta: 'Explore & Export',
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
  },
]

export default function HomePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch(() => {
        /* ignore offline metrics on landing page */
      })
  }, [])

  const straightThroughPct =
    metrics?.straight_through_rate != null ? `${Math.round(metrics.straight_through_rate * 100)}%` : '—'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">FreightFlow AI</span>
              <span className="ml-2 hidden rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 sm:inline-block">
                Logistics Operations Automation
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link to="/dashboard" className="hover:text-indigo-600">
              Dashboard
            </Link>
            <Link to="/process" className="hover:text-indigo-600">
              Process Email
            </Link>
            <Link to="/review" className="hover:text-indigo-600">
              Review Queue
            </Link>
            <Link to="/reports" className="hover:text-indigo-600">
              Reports
            </Link>
            <Link to="/settings" className="hover:text-indigo-600">
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/process"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              Try Demo Email
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              Open Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-indigo-50/30 to-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-medium text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              n8n Orchestration · 4-View PyMuPDF Parser · Groq gpt-oss-120b · Live WebSockets
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Intelligent Freight Email &amp; Shipping Document Automation
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              Turn unstructured freight emails and complex multi-box Bills of Lading PDFs into validated, structured shipment records — with deterministic safety rules and a human-in-the-loop review queue.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/process"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Mail className="h-4 w-4" />
                Process Freight Email &amp; PDF
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-100"
              >
                <LayoutDashboard className="h-4 w-4 text-indigo-600" />
                View Live Operations Dashboard
              </Link>
            </div>
          </div>

          {/* Live System Telemetry Strip */}
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Live Processed Jobs</span>
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics?.total_jobs ?? '—'}</p>
              <p className="mt-1 text-xs text-slate-500">Stored in SQLite operational DB</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Straight-Through Rate</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{straightThroughPct}</p>
              <p className="mt-1 text-xs text-slate-500">Zero-touch validated jobs</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Awaiting Human Review</span>
                <ClipboardCheck className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-700">{metrics?.awaiting_review ?? '—'}</p>
              <p className="mt-1 text-xs text-slate-500">Flagged by deterministic rules</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Dataset Extraction F1</span>
                <Sparkles className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-indigo-700">98.8%</p>
              <p className="mt-1 text-xs text-slate-500">100% classification across 32 emails</p>
            </div>
          </div>
        </div>
      </section>

      {/* End-to-End Pipeline Section */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">End-to-End Architecture</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">How the 5-Stage Freight Pipeline Works</h2>
          <p className="mt-2 text-sm text-slate-600">
            Every submission travels through n8n webhook orchestration, layout-aware PDF parsing, constrained LLM extraction, deterministic validation, and real-time WebSocket streaming.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {PIPELINE_STEPS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.step}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-300"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-600">STEP {item.step}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {item.badge}
                    </span>
                  </div>
                  <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">{item.subtitle}</p>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Interactive Workspace Modules */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Operations Console</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Explore the FreightFlow AI Workspace</h2>
            <p className="mt-2 text-sm text-slate-600">
              Jump directly into any operational view to process shipments, clear review flags, or export reports.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {WORKSPACE_MODULES.map((mod) => {
              const Icon = mod.icon
              return (
                <Link
                  key={mod.to}
                  to={mod.to}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-6 transition hover:border-indigo-300 hover:bg-white hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${mod.accent}`}>
                        <Icon className="h-4 w-4" />
                        {mod.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{mod.description}</p>
                  </div>
                  <div className="mt-5 text-xs font-semibold text-indigo-600 group-hover:underline">
                    {mod.cta} →
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Safety & Guardrails Banner */}
      <section className="border-t border-slate-200 bg-slate-900 py-12 text-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <Lock className="h-4 w-4" />
              Operational Safety Guarantee
            </div>
            <h3 className="text-lg font-bold text-white">
              Human-in-the-Loop by Design — Zero Autonomous External Side Effects
            </h3>
            <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
              FreightFlow AI never automatically confirms carrier bookings, quotes freight rates, alters external TMS records, or sends customer replies. Every ambiguous, incomplete, or complaint email is deterministically held in the Human Review Queue until an operator approves or rejects it.
            </p>
          </div>
          <Link
            to="/review"
            className="shrink-0 rounded-lg bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-400"
          >
            Inspect Review Queue ({metrics?.awaiting_review ?? 0})
          </Link>
        </div>
      </section>
    </div>
  )
}

