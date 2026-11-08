"""Manual live check against Groq using the synthetic demo email. Run from backend/."""
from app.llm_service import extract_freight_information
from app.validator import validate_extraction

BODY = (
    "Hello Operations Team,\nWe need to arrange a shipment from Singapore to Nhava Sheva, India. "
    "The cargo contains 500 cartons of electronic components. Please advise the next steps for a "
    "20-foot container booking. Our expected shipment date is 15 November 2026.\nRegards,\nAnita Rao"
)
r = extract_freight_information("customer@example.com", "New shipment booking request", BODY)
print(r.model_dump_json(indent=2))
print(validate_extraction(r).model_dump_json(indent=2))

