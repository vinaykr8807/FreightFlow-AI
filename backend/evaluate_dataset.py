"""Evaluates the 32 labelled synthetic freight emails in samples/emails/labelled_emails.json.

By default runs in deterministic validator/schema verification mode (offline).
Pass `--live` to run every email against Groq `openai/gpt-oss-120b` and record live
classification accuracy, field-level precision/recall, and review-detection accuracy.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

from app.llm_service import extract_freight_information
from app.schemas import ExtractionResult
from app.validator import validate_extraction

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(ROOT, "samples", "emails", "labelled_emails.json")
RESULTS_PATH = os.path.join(ROOT, "samples", "emails", "evaluation_results.json")

FIELDS = [
    "customer_name",
    "shipment_reference",
    "container_number",
    "origin",
    "destination",
    "cargo_description",
    "etd",
    "eta",
]


def _norm(val: str | None) -> str | None:
    if val is None:
        return None
    s = " ".join(val.strip().lower().split())
    return s or None


def _field_match(expected: str | None, actual: str | None) -> bool:
    e, a = _norm(expected), _norm(actual)
    if e is None and a is None:
        return True
    if e is None or a is None:
        return False
    return e == a or e in a or a in e


def run_evaluation(live: bool = False) -> dict:
    with open(DATASET_PATH, encoding="utf-8") as f:
        dataset = json.load(f)

    total = len(dataset)
    correct_class = 0
    correct_review = 0
    tp = fp = fn = tn = 0
    details = []

    for item in dataset:
        exp = item["expected"]
        if live:
            pred = extract_freight_information(item["sender"], item["subject"], item["body"])
            time.sleep(0.15)
        else:
            pred = ExtractionResult(
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

        val = validate_extraction(pred)
        class_ok = pred.request_type == exp["request_type"]
        review_ok = val.review_required == exp["review_required"]
        if class_ok:
            correct_class += 1
        if review_ok:
            correct_review += 1

        field_outcomes = {}
        for k in FIELDS:
            e_val = exp.get(k)
            a_val = getattr(pred, k)
            matched = _field_match(e_val, a_val)
            field_outcomes[k] = {"expected": e_val, "actual": a_val, "match": matched}
            if e_val is not None and a_val is not None:
                if matched:
                    tp += 1
                else:
                    fp += 1
                    fn += 1
            elif e_val is None and a_val is not None:
                fp += 1
            elif e_val is not None and a_val is None:
                fn += 1
            else:
                tn += 1

        details.append({
            "email_id": item["email_id"],
            "notes": item.get("notes", ""),
            "expected_type": exp["request_type"],
            "predicted_type": pred.request_type,
            "classification_ok": class_ok,
            "expected_review": exp["review_required"],
            "predicted_review": val.review_required,
            "review_ok": review_ok,
            "validation_reasons": val.reasons,
            "fields": field_outcomes,
        })

    precision = round(tp / (tp + fp), 4) if (tp + fp) else 1.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) else 1.0
    f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) else 0.0

    summary = {
        "evaluated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "live_groq" if live else "deterministic_ground_truth",
        "sample_size": total,
        "classification_accuracy": round(correct_class / total, 4),
        "review_detection_accuracy": round(correct_review / total, 4),
        "field_extraction": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        },
        "results": details,
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Call live Groq API for all 32 emails")
    args = parser.parse_args()
    res = run_evaluation(live=args.live)
    print(json.dumps({k: v for k, v in res.items() if k != "results"}, indent=2))
    mismatches = [r for r in res["results"] if not (r["classification_ok"] and r["review_ok"])]
    if mismatches:
        print(f"Mismatches ({len(mismatches)}):")
        for m in mismatches:
            print(" ", m["email_id"], "type:", m["expected_type"], "->", m["predicted_type"],
                  "review:", m["expected_review"], "->", m["predicted_review"])
    sys.exit(0)

