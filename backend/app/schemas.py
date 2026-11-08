from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

RequestType = Literal[
    "booking_request",
    "tracking_request",
    "quotation_request",
    "documentation_request",
    "complaint",
    "other",
]


class ExtractionResult(BaseModel):
    """Business fields returned by the LLM. Workflow metadata is NOT included."""

    request_type: RequestType
    customer_name: Optional[str] = None
    shipment_reference: Optional[str] = None
    container_number: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    cargo_description: Optional[str] = None
    etd: Optional[str] = None
    eta: Optional[str] = None
    summary: Optional[str] = None

    @field_validator("container_number", mode="before")
    @classmethod
    def _clean_container(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            # Strip common carrier formatting separators (spaces, hyphens, slashes) only when it forms a 4L+7D ISO ID
            compact = "".join(ch for ch in v.upper() if ch.isalnum())
            if len(compact) == 11 and compact[:4].isalpha() and compact[4:].isdigit():
                return compact
        return v


class JobCreate(BaseModel):
    job_id: str = Field(min_length=1, max_length=100)
    email_id: str = Field(min_length=1, max_length=200)
    source: Literal["dashboard", "email_trigger"] = "dashboard"


class ProcessRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=100)
    email_id: str = Field(min_length=1, max_length=200)
    sender: str = Field(default="", max_length=320)
    subject: str = Field(default="", max_length=500)
    body: str = Field(min_length=1, max_length=50_000)
    document_text: Optional[str] = Field(default=None, max_length=200_000)
    document_error: Optional[str] = None  # e.g. scanned_or_unreadable_pdf


class ReviewRequest(BaseModel):
    record_id: str = Field(min_length=1, max_length=100)
    job_id: Optional[str] = Field(default=None, max_length=100)
    decision: Literal["approved", "rejected"]
    corrections: dict = Field(default_factory=dict)
    review_note: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _rejection_needs_reason(self):
        if self.decision == "rejected" and not (self.review_note and self.review_note.strip()):
            raise ValueError("review_note is required when rejecting")
        return self


class EventPublish(BaseModel):
    job_id: str = Field(min_length=1, max_length=100)
    event: str
    message: Optional[str] = Field(default=None, max_length=500)
    data: dict = Field(default_factory=dict)


class ValidationResult(BaseModel):
    review_required: bool
    missing_fields: list[str] = []
    reasons: list[str] = []

