import { afterEach, describe, expect, it, vi } from 'vitest'
import { TERMINAL_EVENTS } from '../types/events'
import { ApiError, getJob, getJobEvents, submitEmail, submitReview } from './n8nClient'

describe('TERMINAL_EVENTS contract', () => {
  it('marks completion, review, and failure events as terminal', () => {
    expect(TERMINAL_EVENTS.has('job.completed')).toBe(true)
    expect(TERMINAL_EVENTS.has('review.required')).toBe(true)
    expect(TERMINAL_EVENTS.has('job.failed')).toBe(true)
    expect(TERMINAL_EVENTS.has('review.approved')).toBe(true)
    expect(TERMINAL_EVENTS.has('review.rejected')).toBe(true)
    expect(TERMINAL_EVENTS.has('job.processing')).toBe(false)
    expect(TERMINAL_EVENTS.has('llm.extraction_started')).toBe(false)
  })
})

describe('n8nClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends JSON when submitting an email without a file', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ accepted: true, job_id: 'job-1', status: 'accepted', duplicate: false }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await submitEmail({
      job_id: 'job-1',
      email_id: 'E-1',
      source: 'dashboard',
      sender: 'a@example.com',
      subject: 'Booking',
      body: 'Ship 10 cartons from Singapore to Nhava Sheva',
      received_at: '2026-11-08T12:00:00Z',
    })
    expect(res.accepted).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/webhook/freight/process')
    expect((init as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('sends multipart FormData when a PDF file is attached', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ accepted: true, job_id: 'job-2', status: 'accepted', duplicate: false }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['%PDF-1.4 test'], 'shipping.pdf', { type: 'application/pdf' })
    await submitEmail({
      job_id: 'job-2',
      email_id: 'E-2',
      source: 'dashboard',
      sender: 'a@example.com',
      subject: 'Booking',
      body: 'See attached PDF',
      received_at: '2026-11-08T12:00:00Z',
      file,
    })
    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
  })

  it('returns null for 404 on getJob and empty list on getJobEvents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await getJob('missing')).toBeNull()
    expect(await getJobEvents('missing')).toEqual([])
  })

  it('throws ApiError with readable message on 400/409 review errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: 'Record already reviewed' }),
      }),
    )
    await expect(
      submitReview({
        record_id: 'rec-1',
        job_id: 'job-1',
        decision: 'approved',
        corrections: {},
        review_note: null,
      }),
    ).rejects.toThrowError(new ApiError('Record already reviewed', 409))
  })
})

