import json
import sqlite3
import uuid

from .database import get_conn, utcnow
from .llm_service import LLMError, extract_freight_information
from .realtime import manager
from .schemas import ExtractionResult, JobCreate, ProcessRequest, ReviewRequest
from .validator import validate_extraction

EVENT_MESSAGES = {
    "job.accepted": "Job accepted.",
    "job.processing": "Processing started.",
    "job.duplicate": "Duplicate submission detected.",
    "document.extraction_started": "PDF text extraction started.",
    "document.extraction_completed": "PDF text extraction finished.",
    "llm.extraction_started": "Extraction started.",
    "llm.extraction_completed": "Shipment information extracted.",
    "validation.started": "Validation started.",
    "validation.completed": "Validation finished.",
    "review.required": "Record requires human review.",
    "job.completed": "Automated processing complete.",
    "job.failed": "Processing failed.",
    "review.approved": "A reviewer approved the record.",
    "review.rejected": "A reviewer rejected the record.",
}

# Fields a reviewer may correct (business fields only).
CORRECTABLE = set(ExtractionResult.model_fields)


def _row(r: sqlite3.Row | None) -> dict | None:
    return dict(r) if r else None


def _record_dict(rec: sqlite3.Row, review: sqlite3.Row | None) -> dict:
    rec = dict(rec)
    rec["extracted"] = json.loads(rec.pop("extracted_json"))
    rec["validation"] = json.loads(rec.pop("validation_json"))
    rec["review_required"] = bool(rec["review_required"])
    final = dict(rec["extracted"])
    if review:
        corrections = json.loads(review["corrections_json"] or "{}")
        if review["decision"] == "approved":
            final.update(corrections)
        rec["review"] = {
            "review_id": review["review_id"], "decision": review["decision"],
            "corrections": corrections, "review_note": review["review_note"],
            "reviewed_at": review["reviewed_at"],
        }
    else:
        rec["review"] = None
    rec["final"] = final
    return rec


def create_job(req: JobCreate) -> tuple[dict, bool]:
    """Create a job or return the existing one for the same (source, email_id). Returns (job, created)."""
    now = utcnow()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM jobs WHERE source=? AND email_id=?", (req.source, req.email_id)
        ).fetchone()
        if existing:
            job = dict(existing)
            created = False
        else:
            if conn.execute("SELECT 1 FROM jobs WHERE job_id=?", (req.job_id,)).fetchone():
                raise ValueError("job_id already used by a different email")
            conn.execute(
                "INSERT INTO jobs (job_id, source, email_id, status, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?)",
                (req.job_id, req.source, req.email_id, "accepted", now, now),
            )
            job = dict(conn.execute("SELECT * FROM jobs WHERE job_id=?", (req.job_id,)).fetchone())
            created = True
    # Events are published after the transaction commits.
    if created:
        add_event(job["job_id"], "job.accepted", {"source": req.source})
    else:
        add_event(job["job_id"], "job.duplicate", {"duplicate_job_id": req.job_id})
    return job, created


def get_job(job_id: str) -> dict | None:
    with get_conn() as conn:
        job = _row(conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone())
        if not job:
            return None
        rec = conn.execute("SELECT * FROM processed_records WHERE job_id=?", (job_id,)).fetchone()
        review = None
        if rec:
            review = conn.execute(
                "SELECT * FROM review_decisions WHERE record_id=?", (rec["record_id"],)
            ).fetchone()
        job["record"] = _record_dict(rec, review) if rec else None
        return job


def add_event(job_id: str, event: str, data: dict | None = None, message: str | None = None) -> dict:
    """Persist an event, then broadcast it over WebSocket (persist-first)."""
    payload = data or {}
    ev = {
        "event_id": f"evt-{uuid.uuid4().hex[:12]}",
        "job_id": job_id,
        "event": event,
        "message": message or EVENT_MESSAGES.get(event, event),
        "timestamp": utcnow(),
        "data": payload,
    }
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO job_events (event_id, job_id, event, payload_json, created_at) VALUES (?,?,?,?,?)",
            (ev["event_id"], job_id, event, json.dumps({"message": ev["message"], "data": payload}),
             ev["timestamp"]),
        )
    manager.publish(ev)
    return ev


def get_events(job_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM job_events WHERE job_id=? ORDER BY created_at, rowid", (job_id,)
        ).fetchall()
    out = []
    for r in rows:
        p = json.loads(r["payload_json"])
        out.append({
            "event_id": r["event_id"], "job_id": r["job_id"], "event": r["event"],
            "message": p.get("message", r["event"]), "timestamp": r["created_at"],
            "data": p.get("data", {}),
        })
    return out


def _set_status(job_id: str, status: str, code: str | None = None, message: str | None = None) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE jobs SET status=?, error_code=?, error_message=?, updated_at=? WHERE job_id=?",
            (status, code, message, utcnow(), job_id),
        )


def process_job(req: ProcessRequest) -> dict:
    """Extract, validate and persist a result exactly once per job."""
    job = get_job(req.job_id)
    if job is None:
        raise LookupError("job not found")
    if job["record"] is not None:  # idempotent: already processed
        return job

    _set_status(req.job_id, "processing")
    add_event(req.job_id, "job.processing")
    try:
        add_event(req.job_id, "llm.extraction_started")
        extraction = extract_freight_information(req.sender, req.subject, req.body, req.document_text)
        add_event(req.job_id, "llm.extraction_completed", {"request_type": extraction.request_type})
    except LLMError as e:
        _set_status(req.job_id, "failed", e.code, str(e))
        add_event(req.job_id, "job.failed", {"error_code": e.code})
        return get_job(req.job_id)

    add_event(req.job_id, "validation.started")
    validation = validate_extraction(extraction, req.document_error)
    add_event(req.job_id, "validation.completed", {"review_required": validation.review_required})

    record_id = f"rec-{uuid.uuid4().hex[:10]}"
    status = "needs_review" if validation.review_required else "completed"
    with get_conn() as conn:  # single transaction: record + status
        conn.execute(
            "INSERT INTO processed_records (record_id, job_id, request_type, extracted_json, "
            "validation_json, review_required, created_at) VALUES (?,?,?,?,?,?,?)",
            (record_id, req.job_id, extraction.request_type, extraction.model_dump_json(),
             validation.model_dump_json(), int(validation.review_required), utcnow()),
        )
        conn.execute(
            "UPDATE jobs SET status=?, error_code=NULL, error_message=NULL, updated_at=? WHERE job_id=?",
            (status, utcnow(), req.job_id),
        )
    # Publish final events only after state is committed.
    add_event(req.job_id, "review.required" if validation.review_required else "job.completed",
              {"reasons": validation.reasons} if validation.review_required else None)
    return get_job(req.job_id)


class ReviewError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def submit_review(req: ReviewRequest) -> dict:
    """Persist a human decision. Only records awaiting review can be decided, and only once."""
    bad = set(req.corrections) - CORRECTABLE
    if bad:
        raise ReviewError(422, f"Cannot correct fields: {sorted(bad)}")
    with get_conn() as conn:
        rec = conn.execute("SELECT * FROM processed_records WHERE record_id=?", (req.record_id,)).fetchone()
        if not rec:
            raise ReviewError(404, "Record not found")
        job = conn.execute("SELECT * FROM jobs WHERE job_id=?", (rec["job_id"],)).fetchone()
        if req.job_id and req.job_id != rec["job_id"]:
            raise ReviewError(409, "record_id does not belong to job_id")
        if job["status"] != "needs_review":
            raise ReviewError(409, f"Record is not awaiting review (status: {job['status']})")
        if conn.execute("SELECT 1 FROM review_decisions WHERE record_id=?", (req.record_id,)).fetchone():
            raise ReviewError(409, "Record already reviewed")
        merged = {**json.loads(rec["extracted_json"]), **req.corrections}
        try:
            ExtractionResult.model_validate(merged)
        except Exception:
            raise ReviewError(422, "Corrections produce an invalid record")
        now = utcnow()
        review_id = f"rev-{uuid.uuid4().hex[:10]}"
        conn.execute(
            "INSERT INTO review_decisions (review_id, record_id, decision, corrections_json, "
            "review_note, reviewed_at) VALUES (?,?,?,?,?,?)",
            (review_id, req.record_id, req.decision, json.dumps(req.corrections), req.review_note, now),
        )
        conn.execute("UPDATE jobs SET status=?, updated_at=? WHERE job_id=?",
                     (req.decision, now, rec["job_id"]))
    event = "review.approved" if req.decision == "approved" else "review.rejected"
    add_event(rec["job_id"], event, {"record_id": req.record_id, "review_id": review_id})
    return get_job(rec["job_id"])


def _decode(d: dict) -> dict:
    d["extracted"] = json.loads(d.pop("extracted_json"))
    d["validation"] = json.loads(d.pop("validation_json"))
    if "review_required" in d:
        d["review_required"] = bool(d["review_required"])
    return d


def list_records(request_type=None, status=None, review_required=None, search=None,
                 date_from=None, date_to=None, limit=50, offset=0) -> dict:
    where, params = ["1=1"], []
    if request_type:
        where.append("r.request_type=?"); params.append(request_type)
    if status:
        where.append("j.status=?"); params.append(status)
    if review_required is not None:
        where.append("r.review_required=?"); params.append(int(review_required))
    if date_from:
        where.append("j.created_at>=?"); params.append(date_from)
    if date_to:
        where.append("j.created_at<=?"); params.append(date_to)
    if search:
        like = f"%{search}%"
        where.append("(j.job_id LIKE ? OR j.email_id LIKE ? OR r.extracted_json LIKE ?)")
        params += [like, like, like]
    where_sql = " WHERE " + " AND ".join(where)
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM processed_records r JOIN jobs j ON j.job_id=r.job_id" + where_sql,
            params,
        ).fetchone()[0]
        rows = conn.execute(
            "SELECT r.record_id, r.job_id, r.request_type, r.extracted_json, r.validation_json, "
            "r.review_required, r.created_at, j.status, j.email_id, j.source, "
            "d.decision, d.corrections_json "
            "FROM processed_records r JOIN jobs j ON j.job_id=r.job_id "
            "LEFT JOIN review_decisions d ON d.record_id=r.record_id" + where_sql +
            " ORDER BY r.created_at DESC, r.rowid DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    items = []
    for r in rows:
        d = _decode(dict(r))
        decision = d.pop("decision", None)
        corr_json = d.pop("corrections_json", None)
        if decision == "approved" and corr_json:
            d["extracted"] = {**d["extracted"], **json.loads(corr_json)}
        items.append(d)
    return {"total": total, "limit": limit, "offset": offset, "items": items}


def review_queue() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT r.record_id, r.job_id, r.request_type, r.extracted_json, r.validation_json, "
            "r.created_at, j.email_id FROM processed_records r JOIN jobs j ON j.job_id=r.job_id "
            "WHERE j.status='needs_review' ORDER BY r.created_at, r.rowid"
        ).fetchall()
    return [_decode(dict(r)) for r in rows]


def get_metrics() -> dict:
    """Computed from persisted data. Straight-through rate is NOT AI accuracy."""
    with get_conn() as conn:
        by_status = {r["status"]: r["n"] for r in conn.execute(
            "SELECT status, COUNT(*) n FROM jobs GROUP BY status")}
        by_type = {r["request_type"]: r["n"] for r in conn.execute(
            "SELECT request_type, COUNT(*) n FROM processed_records GROUP BY request_type")}
        dup = conn.execute("SELECT COUNT(*) FROM job_events WHERE event='job.duplicate'").fetchone()[0]
        avg = conn.execute(
            "SELECT AVG((julianday(r.created_at) - julianday(j.created_at)) * 86400.0) "
            "FROM processed_records r JOIN jobs j ON j.job_id=r.job_id").fetchone()[0]
    total = sum(by_status.values())
    needs = by_status.get("needs_review", 0)
    approved = by_status.get("approved", 0)
    rejected = by_status.get("rejected", 0)
    completed = by_status.get("completed", 0)
    processed = completed + needs + approved + rejected
    return {
        "total_jobs": total,
        "completed_without_review": completed,
        "awaiting_review": needs,
        "reviewed_approved": approved,
        "reviewed_rejected": rejected,
        "failed": by_status.get("failed", 0),
        "in_progress": by_status.get("accepted", 0) + by_status.get("processing", 0),
        "classification_breakdown": by_type,
        "avg_processing_seconds": round(avg, 2) if avg is not None else None,
        "duplicate_submissions": dup,
        "straight_through_rate": round(completed / processed, 4) if processed else None,
        "human_review_rate": round((needs + approved + rejected) / processed, 4) if processed else None,
    }
