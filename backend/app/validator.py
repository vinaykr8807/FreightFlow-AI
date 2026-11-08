import re
from datetime import date

from .schemas import ExtractionResult, ValidationResult

# Shape check only: 4 letters + 7 digits. ISO 6346 check digit is a later enhancement.
CONTAINER_RE = re.compile(r"^[A-Z]{4}\d{7}$")


def _blank(v: str | None) -> bool:
    return v is None or not v.strip()


def _valid_iso_date(v: str) -> bool:
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def validate_extraction(data: ExtractionResult, document_error: str | None = None) -> ValidationResult:
    missing: list[str] = []
    reasons: list[str] = []
    rt = data.request_type

    if rt in ("booking_request", "quotation_request"):
        for f in ("origin", "destination"):
            if _blank(getattr(data, f)):
                missing.append(f)
                reasons.append(f"{rt} missing {f}")
        if rt == "booking_request" and _blank(data.cargo_description):
            missing.append("cargo_description")
            reasons.append("booking_request missing cargo_description")

    if rt == "tracking_request" and _blank(data.shipment_reference) and _blank(data.container_number):
        missing.extend(["shipment_reference", "container_number"])
        reasons.append("tracking_request needs shipment_reference or container_number")

    if not _blank(data.container_number) and not CONTAINER_RE.match(data.container_number.strip().upper()):
        reasons.append("container_number has invalid format")

    for f in ("etd", "eta"):
        v = getattr(data, f)
        if not _blank(v) and not _valid_iso_date(v):
            reasons.append(f"{f} is not a valid YYYY-MM-DD date")

    if (
        not _blank(data.origin)
        and not _blank(data.destination)
        and data.origin.strip().lower() == data.destination.strip().lower()
    ):
        reasons.append("origin and destination are identical")

    if rt in ("complaint", "other"):
        reasons.append(f"category '{rt}' always requires human review")

    if document_error:
        reasons.append(f"document error: {document_error}")

    return ValidationResult(review_required=bool(reasons), missing_fields=missing, reasons=reasons)

