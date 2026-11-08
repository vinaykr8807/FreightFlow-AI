import type { Extraction, JobRecord } from '../../types/job'

const FIELDS: [keyof Extraction, string][] = [
  ['request_type', 'Request type'],
  ['customer_name', 'Customer'],
  ['origin', 'Origin'],
  ['destination', 'Destination'],
  ['cargo_description', 'Cargo'],
  ['container_number', 'Container no.'],
  ['shipment_reference', 'Shipment ref.'],
  ['etd', 'ETD'],
  ['eta', 'ETA'],
]

/** Shows reviewer-corrected values (`final`) and marks fields that were changed by a human. */
export default function ExtractedFields({ record }: { record: JobRecord }) {
  const corrected = record.review?.decision === 'approved' ? record.review.corrections : {}
  const missing = new Set(record.validation.missing_fields)
  return (
    <div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {FIELDS.map(([key, label]) => {
          const value = record.final[key]
          const wasCorrected = key in corrected
          return (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="text-sm text-slate-900">
                {value ?? <span className={missing.has(key) ? 'font-medium text-amber-700' : 'text-slate-400'}>
                  {missing.has(key) ? 'Missing' : '—'}
                </span>}
                {wasCorrected && (
                  <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                    corrected (was: {record.extracted[key] ?? 'empty'})
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      {record.final.summary && <p className="mt-4 text-sm text-slate-600">{record.final.summary}</p>}
      {record.validation.reasons.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Flagged for review</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
            {record.validation.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {record.review?.review_note && (
        <p className="mt-3 text-sm text-slate-600">
          Reviewer note: <em>{record.review.review_note}</em>
        </p>
      )}
    </div>
  )
}

