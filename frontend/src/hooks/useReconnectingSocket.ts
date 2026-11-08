import { useEffect, useRef, useState } from 'react'

export type SocketState = 'connecting' | 'open' | 'reconnecting' | 'closed'

const HEARTBEAT_MS = 25_000
const MAX_BACKOFF_MS = 15_000

interface Options {
  onMessage: (data: string) => void
  /** Called on every (re)connect so the caller can resync durable state. */
  onOpen?: () => void
}

/**
 * Generic WebSocket with ping heartbeat and bounded exponential-backoff reconnect.
 * Pass `null` as the url to stay disconnected. Messages are notifications only.
 */
export function useReconnectingSocket(url: string | null, opts: Options): SocketState {
  const [state, setState] = useState<SocketState>('closed')
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  useEffect(() => {
    if (!url) return
    let ws: WebSocket | null = null
    let attempt = 0
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined

    const connect = () => {
      setState(attempt === 0 ? 'connecting' : 'reconnecting')
      ws = new WebSocket(url)
      ws.onopen = () => {
        attempt = 0
        setState('open')
        heartbeat = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), HEARTBEAT_MS)
        optsRef.current.onOpen?.()
      }
      ws.onmessage = (msg) => {
        if (msg.data !== 'pong') optsRef.current.onMessage(String(msg.data))
      }
      ws.onclose = () => {
        clearInterval(heartbeat)
        if (stopped) return
        setState('reconnecting')
        const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
        attempt += 1
        retryTimer = setTimeout(connect, delay)
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(heartbeat)
      ws?.close()
      setState('closed')
    }
  }, [url])

  return state
}

