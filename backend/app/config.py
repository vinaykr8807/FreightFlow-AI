import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Read lazily from the environment so tests can override values."""

    @property
    def groq_api_key(self) -> str | None:
        return os.getenv("GROQ_API_KEY")

    @property
    def groq_model(self) -> str:
        return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    @property
    def database_path(self) -> str:
        return os.getenv("DATABASE_PATH", "data/freightflow.db")

    @property
    def internal_api_token(self) -> str | None:
        return os.getenv("INTERNAL_API_TOKEN")

    @property
    def max_pdf_bytes(self) -> int:
        return int(os.getenv("MAX_PDF_BYTES", str(10 * 1024 * 1024)))

    @property
    def max_pdf_pages(self) -> int:
        return int(os.getenv("MAX_PDF_PAGES", "20"))

    @property
    def max_document_chars(self) -> int:
        """Cap on text passed to the LLM, to bound cost and prompt size."""
        return int(os.getenv("MAX_DOCUMENT_CHARS", "30000"))

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]


settings = Settings()

