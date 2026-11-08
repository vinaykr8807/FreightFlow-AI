import { useCallback, useEffect, useRef, useState } from 'react'
import { getJob, getJobEvents } from '../services/n8nClient'
import { TERMINAL_EVENTS, type JobEvent } from '../types/events'
import type { Job } from '../types/job'
import { useJobWebSocket, type SocketState } from './useJobWebSocket'

export interface JobStream {
  job: Job | null
  events: JobEvent[]
  socket: SocketState
  error: string | null
  refresh: () => Promise<void>
}

function mergeEvents(current: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  const byId = new Map(current.map((e) => [e.event_id, e]))
  for (const e of incoming) byId.set(e.event_id, e)
  // Stable: ISO timestamps sort lexically; insertion order breaks ties.
  return [...byId.values()]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.timestamp === b.e.timestamp ? a.i - b.i : a.e.timestamp < b.e.timestamp ? -1 : 1))
    .map((x) => x.e)
}

/**
 * Live view of one job. The socket connects as soon as jobId is set (so no early events are
 * missed); durable state and history are fetched from n8n only once `started` is true,
 * and again on every reconnect and terminal event.
 */
export function useJobStream(jobId: string | null, started: boolean): JobStream {
  const [job, setJob] = useState<Job | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(started)
  useEffect(() => {
    startedRef.current = started
  })

  const refresh = useCallback(async () => {
    if (!jobId || !startedRef.current) return
    try {
      const [j, history] = await Promise.all([getJob(jobId), getJobEvents(jobId)])
      setJob(j)
      setEvents((cur) => mergeEvents(cur, history))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load job')
    }
  }, [jobId])

  const socket = useJobWebSocket(jobId, {
    onEvent: (e) => {
      setEvents((cur) => mergeEvents(cur, [e]))
      if (TERMINAL_EVENTS.has(e.event)) void refresh()
    },
    onOpen: () => void refresh(),
  })

  // Reset when switching jobs; load once the job has been submitted.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(null)
    setEvents([])
    setError(null)
  }, [jobId])

  useEffect(() => {
    if (started) void refresh()
  }, [started, refresh])

  return { job, events, socket, error, refresh }
}

