"""Excel (.xlsx) report export using Pandas and OpenPyXL (spec section 17).

Includes the active filters and a generated timestamp on a metadata sheet, plus the two
operational tabs (`Processed_Emails` and `Human_Review_Queue`). Raw email bodies are excluded.
"""
import io
import json
from typing import Optional

import pandas as pd

from .database import get_conn, utcnow


def build_excel_report(
    request_type: Optional[str] = None,
    status: Optional[str] = None,
    review_required: Optional[bool] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> bytes:
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

    sql = (
        "SELECT r.record_id, r.job_id, r.request_type, r.extracted_json, r.validation_json, "
        "r.review_required, r.created_at, j.status, j.email_id, j.source, "
        "d.decision, d.corrections_json, d.review_note, d.reviewed_at "
        "FROM processed_records r JOIN jobs j ON j.job_id=r.job_id "
        "LEFT JOIN review_decisions d ON d.record_id=r.record_id "
        "WHERE " + " AND ".join(where) + " ORDER BY r.created_at DESC, r.rowid DESC"
    )
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()

    processed_rows: list[dict] = []
    review_rows: list[dict] = []
    for r in rows:
        extracted = json.loads(r["extracted_json"])
        validation = json.loads(r["validation_json"])
        if r["decision"] == "approved" and r["corrections_json"]:
            extracted.update(json.loads(r["corrections_json"]))
        processed_rows.append({
            "Job ID": r["job_id"],
            "Email ID": r["email_id"],
            "Received Timestamp": r["created_at"],
            "Customer Name": extracted.get("customer_name"),
            "Request Type": extracted.get("request_type") or r["request_type"],
            "Shipment Reference": extracted.get("shipment_reference"),
            "Container Number": extracted.get("container_number"),
            "Origin": extracted.get("origin"),
            "Destination": extracted.get("destination"),
            "Cargo Description": extracted.get("cargo_description"),
            "ETD": extracted.get("etd"),
            "ETA": extracted.get("eta"),
            "Processing Status": r["status"],
            "Review Required": bool(r["review_required"]),
        })
        if r["review_required"]:
            review_rows.append({
                "Job ID": r["job_id"],
                "Record ID": r["record_id"],
                "Request Type": r["request_type"],
                "Missing Fields": ", ".join(validation.get("missing_fields", [])),
                "Validation Reasons": "; ".join(validation.get("reasons", [])),
                "Review Status": r["decision"] or "awaiting_review",
                "Reviewer Note": r["review_note"],
                "Reviewed Timestamp": r["reviewed_at"],
            })

    meta_rows = [
        {"Field": "Generated Timestamp (UTC)", "Value": utcnow()},
        {"Field": "Filter: Request Type", "Value": request_type or "All"},
        {"Field": "Filter: Status", "Value": status or "All"},
        {"Field": "Filter: Review Required", "Value": str(review_required) if review_required is not None else "All"},
        {"Field": "Filter: Search", "Value": search or "None"},
        {"Field": "Filter: Date From", "Value": date_from or "None"},
        {"Field": "Filter: Date To", "Value": date_to or "None"},
        {"Field": "Total Rows Exported", "Value": str(len(processed_rows))},
    ]

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        pd.DataFrame(processed_rows or [{
            k: None for k in [
                "Job ID", "Email ID", "Received Timestamp", "Customer Name", "Request Type",
                "Shipment Reference", "Container Number", "Origin", "Destination",
                "Cargo Description", "ETD", "ETA", "Processing Status", "Review Required",
            ]
        }][:0]).to_excel(writer, sheet_name="Processed_Emails", index=False)
        pd.DataFrame(review_rows or [{
            k: None for k in [
                "Job ID", "Record ID", "Request Type", "Missing Fields",
                "Validation Reasons", "Review Status", "Reviewer Note", "Reviewed Timestamp",
            ]
        }][:0]).to_excel(writer, sheet_name="Human_Review_Queue", index=False)
        pd.DataFrame(meta_rows).to_excel(writer, sheet_name="Report_Metadata", index=False)
    return buf.getvalue()

