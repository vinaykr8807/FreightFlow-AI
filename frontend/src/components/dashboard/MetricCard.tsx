interface Props {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'amber' | 'red' | 'green'
}

const TONES = {
  default: 'text-slate-900',
  amber: 'text-amber-700',
  red: 'text-red-700',
  green: 'text-emerald-700',
}

export default function MetricCard({ label, value, hint, tone = 'default' }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

