"""In-memory WebSocket connection manager (single FastAPI process; see spec section 8).

Events are persisted in SQLite first; WebSocket delivery is only a notification.
"""
import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.jobs: dict[str, set[WebSocket]] = defaultdict(set)
        self.dashboard: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop | None) -> None:
        self.loop = loop

    async def connect_job(self, job_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.jobs[job_id].add(ws)

    async def connect_dashboard(self, ws: WebSocket) -> None:
        await ws.accept()
        self.dashboard.add(ws)

    def disconnect(self, ws: WebSocket, job_id: str | None = None) -> None:
        self.dashboard.discard(ws)
        if job_id is not None:
            self.jobs[job_id].discard(ws)
            if not self.jobs[job_id]:
                self.jobs.pop(job_id, None)

    async def _send_all(self, sockets: list[WebSocket], event: dict) -> None:
        for ws in sockets:
            try:
                await ws.send_json(event)
            except Exception:
                self.dashboard.discard(ws)
                for s in self.jobs.values():
                    s.discard(ws)

    async def broadcast(self, event: dict) -> None:
        targets = list(self.jobs.get(event["job_id"], ())) + list(self.dashboard)
        await self._send_all(targets, event)

    def publish(self, event: dict) -> None:
        """Thread-safe: called from sync request handlers running in the threadpool."""
        if self.loop is None or self.loop.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(event), self.loop)
        except Exception:  # never let a notification failure break processing
            log.warning("event broadcast failed", exc_info=True)


manager = ConnectionManager()

