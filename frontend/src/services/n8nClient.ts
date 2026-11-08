import type {
  Job,
  Metrics,
  RecordList,
  ReviewDecisionPayload,
  ReviewQueueItem,
  SubmitEmailPayload,
} from '../types/job'
import type { JobEvent } from '../types/events'

// Public browser configuration only. No secrets here: React talks to n8n, never to Groq.
export const N8N_BASE_URL = (import.meta.env.VITE_N8N_BASE_URL as string | undefined) ?? 'http://localhost:5678'
const BASE = N8N_BASE_URL
export const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (Array.isArray(body?.errors)) return body.errors.join('; ')
    if (typeof body?.detail === 'string') return body.detail
  } catch {
    /* fall through to a safe generic message */
  }
  return `Request failed (${res.status})`
}

export interface SubmitResponse {
  accepted: boolean
  job_id: string
  status: string
  duplicate: boolean
}

export async function submitEmail(payload: SubmitEmailPayload): Promise<SubmitResponse> {
  const { file, ...fields } = payload
  let init: RequestInit
  if (file) {
    // Binary attachments go as multipart/form-data (never base64 JSON).
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
    form.append('file', file, file.name)
    init = { method: 'POST', body: form }
  } else {
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }
  }
  const res = await fetch(`${BASE}/webhook/freight/process`, init)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

/** Returns null when the job does not exist (yet). */
export async function getJob(jobId: string): Promise<Job | null> {
  const res = await fetch(`${BASE}/webhook/freight/job?job_id=${encodeURIComponent(jobId)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function getMetrics(): Promise<Metrics> {
  const res = await fetch(`${BASE}/webhook/freight/metrics`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function getRecords(params: Record<string, string | number> = {}): Promise<RecordList> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await fetch(`${BASE}/webhook/freight/records?${qs}`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function exportReportExcel(params: Record<string, string> = {}): Promise<Blob> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ''))
  const res = await fetch(`${BASE}/webhook/freight/reports-export?${qs}`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.blob()
}

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const res = await fetch(`${BASE}/webhook/freight/review-queue`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

/** Persists the human decision through n8n. Throws ApiError with a safe message on 400/404/409/422. */
export async function submitReview(payload: ReviewDecisionPayload): Promise<Job> {
  const res = await fetch(`${BASE}/webhook/freight/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function getJobEvents(jobId: string): Promise<JobEvent[]> {
  const res = await fetch(`${BASE}/webhook/freight/job-events?job_id=${encodeURIComponent(jobId)}`)
  if (res.status === 404) return []
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

