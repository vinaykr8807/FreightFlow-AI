import { WS_URL } from '../services/n8nClient'
import type { JobEvent } from '../types/events'
import { useReconnectingSocket, type SocketState } from './useReconnectingSocket'

interface Options {
  onEvent: (e: JobEvent) => void
  onOpen?: () => void
}

/** Subscribes to /ws/dashboard: events for every job, from any ingestion source. */
export function useDashboardWebSocket(opts: Options): SocketState {
  return useReconnectingSocket(`${WS_URL}/ws/dashboard`, {
    onMessage: (d) => {
      try {
        opts.onEvent(JSON.parse(d) as JobEvent)
      } catch {
        /* ignore malformed frames */
      }
    },
    onOpen: opts.onOpen,
  })
}

