import json

import pytest

from app import job_service
from app.llm_service import LLMError, parse_llm_output
from app.schemas import ExtractionResult

GOOD = ExtractionResult(
    request_type="booking_request", customer_name="Anita Rao", origin="Singapore",
    destination="Nhava Sheva, India", cargo_description="500 cartons of electronic components",
    etd="2026-11-15", summary="Booking request.",
)


def body(job_id="job-1", email_id="EMAIL-1"):
    return {"job_id": job_id, "email_id": email_id, "sender": "a@example.com",
            "subject": "Booking", "body": "Ship from Singapore to Nhava Sheva."}


def new_job(client, job_id="job-1", email_id="EMAIL-1"):
    return client.post("/internal/jobs", json={"job_id": job_id, "email_id": email_id})


def test_missing_token_rejected(client):
    r = client.post("/internal/jobs", json={"job_id": "j", "email_id": "e"}, headers={"X-Internal-Token": ""})
    assert r.status_code == 401


def test_wrong_token_rejected(client):
    assert client.get("/internal/jobs/x", headers={"X-Internal-Token": "nope"}).status_code == 401


def test_duplicate_email_returns_existing(client):
    a = new_job(client).json()
    b = new_job(client, job_id="job-2").json()
    assert a["created"] and b["duplicate"] and b["job"]["job_id"] == "job-1"


def test_process_stores_once(client, monkeypatch):
    calls = []
    monkeypatch.setattr(job_service, "extract_freight_information",
                        lambda *a, **k: calls.append(1) or GOOD)
    new_job(client)
    r1 = client.post("/internal/process", json=body()).json()
    r2 = client.post("/internal/process", json=body()).json()
    assert r1["status"] == "completed" and r2["record"]["record_id"] == r1["record"]["record_id"]
    assert len(calls) == 1
    events = [e["event"] for e in client.get("/internal/jobs/job-1/events").json()]
    assert events[-1] == "job.completed" and "llm.extraction_completed" in events


def test_incomplete_goes_to_review_not_failed(client, monkeypatch):
    monkeypatch.setattr(job_service, "extract_freight_information",
                        lambda *a, **k: GOOD.model_copy(update={"destination": None}))
    new_job(client)
    r = client.post("/internal/process", json=body()).json()
    assert r["status"] == "needs_review" and r["record"]["review_required"] is True


def test_llm_failure_is_controlled(client, monkeypatch):
    def boom(*a, **k):
        raise LLMError("llm_provider_error", "failed", retryable=True)

    monkeypatch.setattr(job_service, "extract_freight_information", boom)
    new_job(client)
    r = client.post("/internal/process", json=body()).json()
    assert r["status"] == "failed" and r["record"] is None and r["error_code"] == "llm_provider_error"


def test_process_unknown_job_404(client):
    assert client.post("/internal/process", json=body("nope")).status_code == 404


def test_malformed_llm_output():
    for bad in (None, "", "not json", json.dumps({"request_type": "banana"})):
        with pytest.raises(LLMError):
            parse_llm_output(bad)

