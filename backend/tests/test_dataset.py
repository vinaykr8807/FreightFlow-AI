import json
import os

from app.schemas import ExtractionResult
from app.validator import validate_extraction

DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "samples",
    "emails",
    "labelled_emails.json",
)


def test_labelled_dataset_has_30_plus_cases_and_matches_validator():
    with open(DATASET_PATH, encoding="utf-8") as f:
        dataset = json.load(f)

    assert 30 <= len(dataset) <= 50
    seen_ids = set()
    categories = set()

    for item in dataset:
        eid = item["email_id"]
        assert eid not in seen_ids, f"Duplicate email_id {eid}"
        seen_ids.add(eid)

        exp = item["expected"]
        categories.add(exp["request_type"])
        extraction = ExtractionResult(
            request_type=exp["request_type"],
            customer_name=exp["customer_name"],
            shipment_reference=exp["shipment_reference"],
            container_number=exp["container_number"],
            origin=exp["origin"],
            destination=exp["destination"],
            cargo_description=exp["cargo_description"],
            etd=exp["etd"],
            eta=exp["eta"],
            summary=item["subject"],
        )
        validation = validate_extraction(extraction)
        assert validation.review_required == exp["review_required"], (
            f"{eid} ({item.get('notes')}): expected review_required={exp['review_required']}, "
            f"got {validation.review_required} ({validation.reasons})"
        )

    assert categories == {
        "booking_request",
        "tracking_request",
        "quotation_request",
        "documentation_request",
        "complaint",
        "other",
    }

