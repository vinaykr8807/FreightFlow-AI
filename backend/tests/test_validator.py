from app.schemas import ExtractionResult
from app.validator import validate_extraction


def ex(**kw):
    base = dict(request_type="booking_request", origin="Singapore", destination="Nhava Sheva",
                cargo_description="500 cartons")
    base.update(kw)
    return ExtractionResult(**base)


def test_complete_booking_ok():
    assert not validate_extraction(ex()).review_required


def test_booking_missing_destination():
    r = validate_extraction(ex(destination=None))
    assert r.review_required and "destination" in r.missing_fields


def test_booking_missing_origin_and_cargo():
    r = validate_extraction(ex(origin=" ", cargo_description=None))
    assert {"origin", "cargo_description"} <= set(r.missing_fields)


def test_quote_missing_route():
    assert validate_extraction(ex(request_type="quotation_request", origin=None)).review_required


def test_tracking_without_reference():
    assert validate_extraction(ExtractionResult(request_type="tracking_request")).review_required


def test_tracking_with_container_ok():
    r = validate_extraction(ExtractionResult(request_type="tracking_request", container_number="TEST1234567"))
    assert not r.review_required


def test_invalid_container():
    assert validate_extraction(ex(container_number="ABC123")).review_required


def test_bad_date():
    assert validate_extraction(ex(etd="15/11/2026")).review_required


def test_complaint_and_other_need_review():
    assert validate_extraction(ExtractionResult(request_type="complaint")).review_required
    assert validate_extraction(ExtractionResult(request_type="other")).review_required


def test_document_error():
    assert validate_extraction(ex(), "scanned_or_unreadable_pdf").review_required


def test_same_origin_destination():
    assert validate_extraction(ex(origin="Pune", destination="pune")).review_required

