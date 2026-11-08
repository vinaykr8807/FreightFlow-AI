import asyncio
import hmac
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import (Depends, FastAPI, File, Form, Header, HTTPException, Query, Response, UploadFile,
                     WebSocket, WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware

from . import job_service, pdf_parser, report_service
from .config import settings
from .database import init_db
from .realtime import manager
from .schemas import EventPublish, JobCreate, ProcessRequest, ReviewRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    manager.bind_loop(asyncio.get_running_loop())
    yield
    manager.bind_loop(None)


app = FastAPI(title="FreightFlow AI Internal Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    expected = settings.internal_api_token
    if not expected or not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing internal token")


internal = Depends(require_internal_token)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/internal/jobs", dependencies=[internal])
def create_job(req: JobCreate) -> dict:
    try:
        job, created = job_service.create_job(req)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"created": created, "duplicate": not created, "job": job}


@app.get("/internal/jobs/{job_id}", dependencies=[internal])
def get_job(job_id: str) -> dict:
    job = job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/internal/jobs/{job_id}/events", dependencies=[internal])
def get_events(job_id: str) -> list[dict]:
    if not job_service.get_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return job_service.get_events(job_id)


@app.post("/internal/documents/extract", dependencies=[internal])
def extract_document(file: UploadFile = File(...), job_id: Optional[str] = Form(default=None)) -> dict:
    """Extract text from an uploaded PDF. Problems are returned as a controlled `status: error`
    result (not an HTTP error) so the workflow can route the record to human review."""
    emit = bool(job_id) and job_service.get_job(job_id) is not None
    if emit:
        job_service.add_event(job_id, "document.extraction_started")
    # Read at most limit+1 bytes so an oversized upload can't exhaust memory.
    data = file.file.read(settings.max_pdf_bytes + 1)
    result = pdf_parser.extract_pdf_text(data)
    if emit:
        job_service.add_event(
            job_id, "document.extraction_completed",
            {"status": result.status, "error_code": result.error_code,
             "pages": result.pages, "chars": result.chars},
            message="PDF text extraction finished." if result.status == "ok"
            else "PDF could not be read; flagged for review.",
        )
    return result.model_dump()


@app.post("/internal/process", dependencies=[internal])
def process(req: ProcessRequest) -> dict:
    try:
        return job_service.process_job(req)
    except LookupError:
        raise HTTPException(status_code=404, detail="Job not found; create it first")


@app.get("/internal/records", dependencies=[internal])
def records(
    request_type: Optional[str] = None,
    status: Optional[str] = None,
    review_required: Optional[bool] = None,
    search: Optional[str] = Query(default=None, max_length=200),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return job_service.list_records(request_type, status, review_required, search,
                                    date_from, date_to, limit, offset)


@app.get("/internal/reports/export", dependencies=[internal])
def export_report(
    request_type: Optional[str] = None,
    status: Optional[str] = None,
    review_required: Optional[bool] = None,
    search: Optional[str] = Query(default=None, max_length=200),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Response:
    xlsx = report_service.build_excel_report(request_type, status, review_required, search, date_from, date_to)
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="freightflow_report.xlsx"'},
    )


@app.get("/internal/reviews/queue", dependencies=[internal])
def review_queue() -> list[dict]:
    return job_service.review_queue()


@app.post("/internal/reviews", dependencies=[internal])
def submit_review(req: ReviewRequest) -> dict:
    try:
        return job_service.submit_review(req)
    except job_service.ReviewError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/internal/metrics", dependencies=[internal])
def metrics() -> dict:
    return job_service.get_metrics()


@app.post("/internal/events", dependencies=[internal])
def publish_event(req: EventPublish) -> dict:
    if req.event not in job_service.EVENT_MESSAGES:
        raise HTTPException(status_code=422, detail=f"Unknown event '{req.event}'")
    if not job_service.get_job(req.job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return job_service.add_event(req.job_id, req.event, req.data, req.message)


def _origin_ok(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    return origin is None or origin in settings.allowed_origins


async def _hold(ws: WebSocket, job_id: str | None) -> None:
    """Keep the socket open; clients send 'ping' heartbeats and get 'pong'."""
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws, job_id)


# NOTE: MVP has no user auth on WebSockets; add a short-lived signed token before production.
@app.websocket("/ws/jobs/{job_id}")
async def ws_job(ws: WebSocket, job_id: str) -> None:
    if not _origin_ok(ws):
        await ws.close(code=1008)
        return
    await manager.connect_job(job_id, ws)
    await _hold(ws, job_id)


@app.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket) -> None:
    if not _origin_ok(ws):
        await ws.close(code=1008)
        return
    await manager.connect_dashboard(ws)
    await _hold(ws, None)
