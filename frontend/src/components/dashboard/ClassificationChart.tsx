import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function ClassificationChart({ breakdown }: { breakdown: Record<string, number> }) {
  const data = Object.entries(breakdown).map(([k, v]) => ({ name: k.replace('_request', '').replace('_', ' '), count: v }))
  if (data.length === 0) return <p className="text-sm text-slate-500">No classified emails yet.</p>
  return (
    <div className="h-56" role="img" aria-label="Emails by request type">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

