import { WS_URL } from '../services/n8nClient'
import type { JobEvent } from '../types/events'
import { useReconnectingSocket, type SocketState } from './useReconnectingSocket'

export type { SocketState }

interface Options {
  onEvent: (e: JobEvent) => void
  onOpen?: () => void
}

function parse(data: string): JobEvent | null {
  try {
    return JSON.parse(data) as JobEvent
  } catch {
    return null
  }
}

/** Subscribes to /ws/jobs/{jobId}. Durable state always comes from n8n, not the socket. */
export function useJobWebSocket(jobId: string | null, opts: Options): SocketState {
  return useReconnectingSocket(jobId ? `${WS_URL}/ws/jobs/${encodeURIComponent(jobId)}` : null, {
    onMessage: (d) => {
      const e = parse(d)
      if (e) opts.onEvent(e)
    },
    onOpen: opts.onOpen,
  })
}
