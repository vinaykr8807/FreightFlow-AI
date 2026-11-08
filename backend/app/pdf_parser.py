"""Safe, layout-aware text extraction from digital (text-based) PDFs using PyMuPDF.

To handle arbitrary carrier/forwarder PDF templates (boxed Bill of Lading forms, multi-column
shipping instructions, borderless whitespace tables, and fillable AcroForm PDFs) without any
template-specific rules, extraction combines up to four complementary views per page:

1. **Spatial block view (`blocks`)**: every visual text block sorted top-to-bottom, left-to-right,
   keeping multi-line text inside each grid cell grouped together instead of interleaving words
   across adjacent columns on the same horizontal line.
2. **Reading-order layout view (`text` with `sort=True`)**: preserves line-by-line tabular alignment
   for borderless / whitespace-aligned tables.
3. **Structured Markdown tables (`find_tables`)**: detects ruled/grid tables and renders them as
   `| col | col |` Markdown so headers and row values stay explicitly paired.
4. **Interactive form fields (`widgets`)**: extracts AcroForm / XFA key-value pairs (`field: value`)
   for fillable PDF templates.

Scanned/image-only PDFs are NOT OCR'd in the MVP: they are reported as a document error so the
record is routed to human review (reason `scanned_or_unreadable_pdf`).
"""
from typing import Literal, Optional

import pymupdf
from pydantic import BaseModel

from .config import settings

PDF_SIGNATURE = b"%PDF-"
# Fewer meaningful characters than this means the PDF has no usable text layer.
MIN_TEXT_CHARS = 20


class DocumentResult(BaseModel):
    status: Literal["ok", "error"]
    error_code: Optional[str] = None
    text: str = ""
    pages: int = 0
    chars: int = 0
    truncated: bool = False


def _error(code: str, pages: int = 0) -> DocumentResult:
    return DocumentResult(status="error", error_code=code, pages=pages)


def _extract_page_views(page: pymupdf.Page, page_num: int) -> str:
    sections: list[str] = []

    # 1. Spatial block view: groups lines that belong to the same visual box/cell together.
    raw_blocks = page.get_text("blocks") or []
    # Sort by vertical band (quantised to 6pt rows) then horizontal x0
    sorted_blocks = sorted(raw_blocks, key=lambda b: (round(b[1] / 6.0), round(b[0] / 6.0)))
    block_lines: list[str] = []
    for b in sorted_blocks:
        if len(b) >= 7 and b[6] != 0:  # skip image blocks (block_type != 0)
            continue
        cell_text = " | ".join(line.strip() for line in str(b[4]).splitlines() if line.strip())
        if cell_text:
            block_lines.append(f"[x={int(b[0])},y={int(b[1])}] {cell_text}")
    if block_lines:
        sections.append(f"--- Page {page_num} Spatial Cells / Blocks ---\n" + "\n".join(block_lines))

    # 2. Line-sorted layout view: preserves horizontal row alignment across columns.
    layout_text = page.get_text("text", sort=True).strip()
    if layout_text:
        sections.append(f"--- Page {page_num} Layout Text ---\n{layout_text}")

    # 3. Ruled / grid table detection -> Markdown tables.
    try:
        tables = page.find_tables()
        md_tables: list[str] = []
        for t in getattr(tables, "tables", []) or []:
            md = t.to_markdown().strip()
            if md:
                md_tables.append(md)
        if md_tables:
            sections.append(f"--- Page {page_num} Detected Tables ---\n" + "\n\n".join(md_tables))
    except Exception:
        pass

    # 4. Interactive AcroForm widgets (fillable PDF templates).
    widget_lines: list[str] = []
    for w in page.widgets() or []:
        val = (w.field_value or "").strip()
        if val:
            name = " ".join((w.field_name or "field").split())
            widget_lines.append(f"{name}: {val}")
    if widget_lines:
        sections.append(f"--- Page {page_num} Form Fields (Key: Value) ---\n" + "\n".join(widget_lines))

    return "\n\n".join(sections)


def extract_pdf_text(data: bytes) -> DocumentResult:
    if len(data) > settings.max_pdf_bytes:
        return _error("file_too_large")
    # Never trust the filename or declared MIME type: check the magic bytes.
    if not data.lstrip()[:5] == PDF_SIGNATURE:
        return _error("invalid_pdf")

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        return _error("invalid_pdf")

    try:
        if doc.needs_pass:
            return _error("encrypted_pdf")
        pages = doc.page_count
        if pages > settings.max_pdf_pages:
            return _error("too_many_pages", pages)

        raw_char_count = 0
        parts: list[str] = []
        for idx, page in enumerate(doc, start=1):
            raw_txt = page.get_text("text")
            widget_txt = "".join((w.field_value or "").strip() for w in (page.widgets() or []))
            raw_char_count += len("".join((raw_txt + widget_txt).split()))
            page_view = _extract_page_views(page, idx)
            if page_view:
                parts.append(page_view)
        text = "\n\n".join(parts).strip()
    except Exception:
        return _error("invalid_pdf")
    finally:
        doc.close()

    if raw_char_count < MIN_TEXT_CHARS:
        return _error("scanned_or_unreadable_pdf", pages)

    limit = settings.max_document_chars
    truncated = len(text) > limit
    if truncated:
        text = text[:limit]
    return DocumentResult(status="ok", text=text, pages=pages, chars=len(text), truncated=truncated)
