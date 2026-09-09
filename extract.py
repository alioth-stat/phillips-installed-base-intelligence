"""Observation extraction schema + Spanish prompt, wrapping qvac_client."""
import json

import qvac_client

EXTRACTION_FIELDS = ["customer", "city", "country", "modality", "quantity", "brand", "model", "age_years"]

_STR = {"type": ["string", "null"]}
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "customer": _STR,
        "city": _STR,
        "country": _STR,
        "modality": _STR,
        "quantity": {"type": ["integer", "null"]},
        "brand": _STR,
        "model": _STR,
        "age_years": {"type": ["number", "null"]},
    },
    "required": [],
}

SYSTEM_PROMPT = """Eres un asistente que extrae datos estructurados de la observación de un \
representante de campo sobre equipos médicos en un hospital.

Extrae estos campos del texto: customer (nombre del hospital), city, country, \
modality (tipo de equipo, ej. "Resonador Magnético (MRI)"), quantity (cantidad), \
brand (marca), model (modelo), age_years (antigüedad del equipo en años; si dan una \
descripción relativa como "unos ocho años", usa el número estimado).

Si un campo no se menciona o no se puede determinar, devuelve null para ese campo — \
nunca inventes un valor. Responde ÚNICAMENTE con el objeto JSON, sin texto adicional.

Ejemplo:
Texto: "Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores."
JSON: {"customer": "Hospital DemoCare Pacific", "city": null, "country": "Panamá", \
"modality": "Resonador Magnético (MRI)", "quantity": 2, "brand": null, "model": null, \
"age_years": null}
"""


_NULLISH_STRINGS = {"", "null", "none", "n/a", "desconocido"}


def _normalize(raw: dict) -> dict:
    out = {}
    for field in EXTRACTION_FIELDS:
        value = raw.get(field)
        if isinstance(value, str) and value.strip().lower() in _NULLISH_STRINGS:
            value = None
        out[field] = value
    return out


def extract(text: str) -> dict:
    # ponytail: the model's first completion after a cold load occasionally
    # fails -- sometimes empty/truncated (invalid JSON), sometimes syntactically
    # valid JSON with every field null (both observed live, on separate runs).
    # Retry on either shape; a real backoff loop would be overkill here.
    for attempt in range(2):
        raw_text = qvac_client.extract_sync(text, JSON_SCHEMA, system_prompt=SYSTEM_PROMPT)
        try:
            raw = json.loads(raw_text)
            normalized = _normalize(raw) if raw else {}
            if any(v is not None for v in normalized.values()):
                return normalized
        except (json.JSONDecodeError, TypeError):
            pass
        print(f"extract: attempt {attempt + 1} did not return usable fields, got: {raw_text!r}")
    return _normalize({})
