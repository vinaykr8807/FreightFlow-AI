import pytest

from app import job_service
from app.schemas import ExtractionResult

GOOD = ExtractionResult(
    request_type="booking_request", customer_name="Anita Rao", origin="Singapore",
    destination="Nhava Sheva, India", cargo_description="500 cartons", etd="2026-11-15",
)


def make(client, monkeypatch, n=1, extraction=GOOD):
    monkeypatch.setattr(job_service, "extract_freight_information", lambda *a, **k: extraction)
    for i in range(n):
        client.post("/internal/jobs", json={"job_id": f"job-{i}", "email_id": f"E-{i}"})
        client.post("/internal/process", json={"job_id": f"job-{i}", "email_id": f"E-{i}", "body": "x"})


def review_needed(client, monkeypatch):
    make(client, monkeypatch, extraction=GOOD.model_copy(update={"destination": None}))
    return client.get("/internal/jobs/job-0").json()["record"]["record_id"]


def test_approve_with_corrections(client, monkeypatch):
    rid = review_needed(client, monkeypatch)
    r = client.post("/internal/reviews", json={
        "record_id": rid, "job_id": "job-0", "decision": "approved",
        "corrections": {"destination": "Nhava Sheva, India"}, "review_note": "checked"})
    assert r.status_code == 200
    job = r.json()
    assert job["status"] == "approved"
    assert job["record"]["final"]["destination"] == "Nhava Sheva, India"
    assert job["record"]["extracted"]["destination"] is None  # original preserved
    events = [e["event"] for e in client.get("/internal/jobs/job-0/events").json()]
    assert events[-1] == "review.approved"


def test_reject_requires_note(client, monkeypatch):
    rid = review_needed(client, monkeypatch)
    r = client.post("/internal/reviews", json={"record_id": rid, "decision": "rejected"})
    assert r.status_code == 422
    r = client.post("/internal/reviews", json={"record_id": rid, "decision": "rejected", "review_note": "spam"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"


def test_double_review_conflict(client, monkeypatch):
    rid = review_needed(client, monkeypatch)
    body = {"record_id": rid, "decision": "approved"}
    assert client.post("/internal/reviews", json=body).status_code == 200
    assert client.post("/internal/reviews", json=body).status_code == 409


def test_cannot_review_completed_or_unknown(client, monkeypatch):
    make(client, monkeypatch)
    rid = client.get("/internal/jobs/job-0").json()["record"]["record_id"]
    assert client.post("/internal/reviews", json={"record_id": rid, "decision": "approved"}).status_code == 409
    assert client.post("/internal/reviews", json={"record_id": "nope", "decision": "approved"}).status_code == 404


def test_unknown_correction_field_rejected(client, monkeypatch):
    rid = review_needed(client, monkeypatch)
    r = client.post("/internal/reviews", json={"record_id": rid, "decision": "approved",
                                               "corrections": {"status": "hacked"}})
    assert r.status_code == 422


def test_records_filters_and_pagination(client, monkeypatch):
    make(client, monkeypatch, n=3)
    assert client.get("/internal/records").json()["total"] == 3
    page = client.get("/internal/records?limit=2&offset=2").json()
    assert len(page["items"]) == 1 and page["total"] == 3
    assert client.get("/internal/records?request_type=complaint").json()["total"] == 0
    assert client.get("/internal/records?status=completed").json()["total"] == 3
    assert client.get("/internal/records?search=Singapore").json()["total"] == 3
    assert client.get("/internal/records?limit=0").status_code == 422


def test_review_queue(client, monkeypatch):
    rid = review_needed(client, monkeypatch)
    q = client.get("/internal/reviews/queue").json()
    assert [r["record_id"] for r in q] == [rid]
    client.post("/internal/reviews", json={"record_id": rid, "decision": "approved"})
    assert client.get("/internal/reviews/queue").json() == []


def test_metrics(client, monkeypatch):
    make(client, monkeypatch, n=2)
    client.post("/internal/jobs", json={"job_id": "dup", "email_id": "E-0"})  # duplicate
    m = client.get("/internal/metrics").json()
    assert m["total_jobs"] == 2 and m["completed_without_review"] == 2
    assert m["duplicate_submissions"] == 1
    assert m["classification_breakdown"] == {"booking_request": 2}
    assert m["straight_through_rate"] == 1.0 and "accuracy" not in str(m.keys())


def test_publish_event_validation(client, monkeypatch):
    make(client, monkeypatch)
    ok = client.post("/internal/events", json={"job_id": "job-0", "event": "job.completed"})
    assert ok.status_code == 200 and ok.json()["message"]
    assert client.post("/internal/events", json={"job_id": "job-0", "event": "bogus"}).status_code == 422
    assert client.post("/internal/events", json={"job_id": "zzz", "event": "job.completed"}).status_code == 404


def test_websocket_receives_job_and_dashboard_events(client, monkeypatch):
    monkeypatch.setattr(job_service, "extract_freight_information", lambda *a, **k: GOOD)
    with client.websocket_connect("/ws/jobs/job-0") as wj, client.websocket_connect("/ws/dashboard") as wd:
        client.post("/internal/jobs", json={"job_id": "job-0", "email_id": "E-0"})
        first = wj.receive_json()
        assert first["event"] == "job.accepted" and first["job_id"] == "job-0"
        assert {"event_id", "message", "timestamp", "data"} <= set(first)
        assert wd.receive_json()["event"] == "job.accepted"
        wj.send_text("ping")
        assert wj.receive_text() == "pong"


def test_websocket_rejects_bad_origin(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/dashboard", headers={"origin": "http://evil.example"}):
            pass


def test_excel_report_export(client, monkeypatch):
    import io
    import openpyxl

    make(client, monkeypatch, n=2)
    review_needed(client, monkeypatch)  # overwrites job-0 no, job-0 already exists; use separate job
    client.post("/internal/jobs", json={"job_id": "job-rev", "email_id": "E-rev"})
    monkeypatch.setattr(job_service, "extract_freight_information",
                        lambda *a, **k: GOOD.model_copy(update={"destination": None}))
    client.post("/internal/process", json={"job_id": "job-rev", "email_id": "E-rev", "body": "x"})

    r = client.get("/internal/reports/export?request_type=booking_request")
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    assert set(wb.sheetnames) == {"Processed_Emails", "Human_Review_Queue", "Report_Metadata"}
    assert wb["Processed_Emails"].max_row == 4  # header + 3 records
    assert wb["Human_Review_Queue"].max_row == 2  # header + 1 review record


