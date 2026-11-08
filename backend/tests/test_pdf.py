import pymupdf
import pytest

from app import job_service, pdf_parser
from app.config import settings
from app.schemas import ExtractionResult

BOOKING_TEXT = (
    "BOOKING ADVICE\nCustomer name: Anita Rao\nOrigin: Singapore\nDestination: Nhava Sheva, India\n"
    "Cargo: 500 cartons of electronic components\nETD: 2026-11-15"
)


def make_pdf(text: str | None = BOOKING_TEXT, pages: int = 1) -> bytes:
    doc = pymupdf.open()
    for _ in range(pages):
        page = doc.new_page()
        if text:
            page.insert_text((72, 72), text, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def test_text_pdf_extracts():
    r = pdf_parser.extract_pdf_text(make_pdf())
    assert r.status == "ok" and "Nhava Sheva" in r.text and r.pages == 1 and r.chars > 20


def test_blank_pdf_is_scanned_or_unreadable():
    r = pdf_parser.extract_pdf_text(make_pdf(text=None))
    assert r.status == "error" and r.error_code == "scanned_or_unreadable_pdf"


def test_image_only_pdf_is_flagged():
    doc = pymupdf.open()
    page = doc.new_page()
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 200, 200), False)
    pix.set_rect(pix.irect, (200, 30, 30))
    page.insert_image(page.rect, pixmap=pix)
    r = pdf_parser.extract_pdf_text(doc.tobytes())
    assert r.error_code == "scanned_or_unreadable_pdf"


@pytest.mark.parametrize("bad", [b"", b"not a pdf at all", b"%PDF-1.4 truncated garbage", b"PK\x03\x04zip"])
def test_invalid_pdf_is_controlled_error(bad):
    r = pdf_parser.extract_pdf_text(bad)
    assert r.status == "error" and r.error_code == "invalid_pdf"


def test_signature_is_checked_not_extension():
    # A valid PDF is accepted regardless of any filename; a non-PDF is rejected even if named .pdf.
    assert pdf_parser.extract_pdf_text(make_pdf()).status == "ok"
    assert pdf_parser.extract_pdf_text(b"<html>fake.pdf</html>").error_code == "invalid_pdf"


def test_size_and_page_limits(monkeypatch):
    monkeypatch.setenv("MAX_PDF_BYTES", "100")
    assert pdf_parser.extract_pdf_text(make_pdf()).error_code == "file_too_large"
    monkeypatch.delenv("MAX_PDF_BYTES")
    monkeypatch.setenv("MAX_PDF_PAGES", "2")
    r = pdf_parser.extract_pdf_text(make_pdf(pages=3))
    assert r.error_code == "too_many_pages" and r.pages == 3


def test_encrypted_pdf():
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), BOOKING_TEXT)
    data = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="owner")
    assert pdf_parser.extract_pdf_text(data).error_code == "encrypted_pdf"


def test_text_is_truncated(monkeypatch):
    monkeypatch.setenv("MAX_DOCUMENT_CHARS", "50")
    r = pdf_parser.extract_pdf_text(make_pdf())
    assert r.status == "ok" and r.truncated and len(r.text) == 50


def upload(client, data, job_id=None, name="doc.pdf", token=True):
    headers = {} if token else {"X-Internal-Token": ""}
    return client.post("/internal/documents/extract", files={"file": (name, data, "application/pdf")},
                       data={"job_id": job_id} if job_id else {}, headers=headers)


def test_endpoint_requires_token(client):
    assert upload(client, make_pdf(), token=False).status_code == 401


def test_endpoint_extracts_and_emits_events(client):
    client.post("/internal/jobs", json={"job_id": "job-1", "email_id": "E-1"})
    r = upload(client, make_pdf(), job_id="job-1")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    events = {e["event"]: e for e in client.get("/internal/jobs/job-1/events").json()}
    assert "document.extraction_started" in events
    done = events["document.extraction_completed"]
    assert done["data"]["status"] == "ok" and "text" not in done["data"]  # no document text in events


def test_endpoint_invalid_pdf_is_200_with_error(client):
    r = upload(client, b"garbage", name="evil.pdf")
    assert r.status_code == 200 and r.json()["error_code"] == "invalid_pdf"


def test_endpoint_oversize_upload_is_controlled(client, monkeypatch):
    monkeypatch.setenv("MAX_PDF_BYTES", "500")
    r = upload(client, make_pdf() + b"0" * 5000)
    assert r.json()["error_code"] == "file_too_large"


def test_endpoint_unknown_job_still_extracts(client):
    assert upload(client, make_pdf(), job_id="nope").json()["status"] == "ok"


def test_document_error_routes_to_review_and_text_reaches_llm(client, monkeypatch):
    seen = {}

    def fake(sender, subject, body, document_text=None):
        seen["doc"] = document_text
        return ExtractionResult(request_type="booking_request", origin="A", destination="B",
                                cargo_description="x")

    monkeypatch.setattr(job_service, "extract_freight_information", fake)
    client.post("/internal/jobs", json={"job_id": "j1", "email_id": "E1"})
    ok = client.post("/internal/process", json={"job_id": "j1", "email_id": "E1", "body": "see attached",
                                                "document_text": "Cargo: bananas"}).json()
    assert seen["doc"] == "Cargo: bananas" and ok["status"] == "completed"

    client.post("/internal/jobs", json={"job_id": "j2", "email_id": "E2"})
    bad = client.post("/internal/process", json={"job_id": "j2", "email_id": "E2", "body": "see attached",
                                                 "document_error": "scanned_or_unreadable_pdf"}).json()
    assert bad["status"] == "needs_review"
    assert any("scanned_or_unreadable_pdf" in r for r in bad["record"]["validation"]["reasons"])

