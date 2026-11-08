import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileSpreadsheet, Home, LayoutDashboard, Mail, Search, Settings } from 'lucide-react'
import { useState } from 'react'

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Layout() {
  const [lookup, setLookup] = useState('')
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <Link to="/" className="mb-6 block text-lg font-semibold text-slate-900 hover:text-indigo-600">
          FreightFlow AI
        </Link>
        <nav className="space-y-1">
          <NavLink to="/" end className={link}>
            <Home className="h-4 w-4" /> Home
          </NavLink>
          <NavLink to="/dashboard" className={link}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/process" className={link}>
            <Mail className="h-4 w-4" /> Process Email
          </NavLink>
          <NavLink to="/review" className={link}>
            <ClipboardCheck className="h-4 w-4" /> Review Queue
          </NavLink>
          <NavLink to="/reports" className={link}>
            <FileSpreadsheet className="h-4 w-4" /> Reports
          </NavLink>
          <NavLink to="/settings" className={link}>
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        </nav>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (lookup.trim()) navigate(`/jobs/${encodeURIComponent(lookup.trim())}`)
          }}
        >
          <label className="text-xs uppercase tracking-wide text-slate-500">Open job</label>
          <div className="mt-1 flex items-center gap-1">
            <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="job-…"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <button aria-label="Open job" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="mt-8 text-xs text-slate-400">Independent demo. Synthetic data only.</p>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
