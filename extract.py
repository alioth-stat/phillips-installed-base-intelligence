"""Observation extraction schema + Spanish prompt, wrapping qvac_client.

One narration can mention several kinds of equipment ("2 monitores, 1
resonador y 1 desfibrilador"), so the schema is shared visit fields plus an
`items` array -- one entry per equipment class, each saved as its own
observation.
"""
import csv
import json
from pathlib import Path

import qvac_client

VISIT_FIELDS = ["customer", "city", "country"]
ITEM_FIELDS = ["modality", "quantity", "brand", "model", "age_years"]
# Flat per-observation field list (one visit + one item), what db/dedupe/confidence consume.
EXTRACTION_FIELDS = VISIT_FIELDS + ITEM_FIELDS

with open(Path(__file__).parent / "taxonomy.csv", newline="", encoding="utf-8") as f:
    MODALITIES = [r["value"] for r in csv.DictReader(f) if r["category"] == "modality"]

_STR = {"type": ["string", "null"]}
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "customer": _STR,
        "city": _STR,
        "country": _STR,
        "items": {
            "type": "array",
            # ponytail: a grammar-valid array can still run on forever; 10
            # equipment classes per narration is plenty for a field visit.
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    # Enum = the review form's dropdown values, so every detected
                    # class lands on a selectable option instead of free text.
                    "modality": {"enum": [*MODALITIES, None]},
                    "quantity": {"type": ["integer", "null"]},
                    "brand": _STR,
                    "model": _STR,
                    "age_years": {"type": ["number", "null"]},
                },
                "required": ITEM_FIELDS,
            },
        },
    },
    "required": [*VISIT_FIELDS, "items"],
}

SYSTEM_PROMPT = f"""Eres un asistente que extrae datos estructurados sobre equipos médicos \
a partir de un texto. El texto puede ser la narración en español de un representante de \
campo sobre una visita a un hospital, O una descripción en inglés generada automáticamente \
a partir de una foto del equipo (por ejemplo, texto leído de una placa o etiqueta) — \
ambos tipos de texto son válidos, extrae de cualquiera de los dos.

Extrae: customer (nombre del hospital o cliente, si se menciona), city, country, e items: \
una entrada POR CADA tipo de equipo mencionado. Si el texto menciona varios tipos de \
equipo, devuelve un item por cada tipo — nunca omitas ninguno. Cada item tiene: modality \
(tipo de equipo, uno de: {", ".join(MODALITIES)}), quantity (cantidad de ese tipo), brand \
(marca, tal como aparece en el texto), model (modelo o número de modelo, tal como aparece \
en el texto), age_years (antigüedad en años; si dan una descripción relativa como "unos \
ocho años", usa el número estimado).

Si un campo no se menciona o no se puede determinar, devuelve null para ese campo — \
nunca inventes un valor. Responde ÚNICAMENTE con el objeto JSON, sin texto adicional.

Ejemplo 1 (narración de un representante de campo):
Texto: "Estoy en Hospital DemoCare Pacific, en Panamá. Vi dos monitores, un resonador de \
unos ocho años y un desfibrilador Philips."
JSON: {{"customer": "Hospital DemoCare Pacific", "city": null, "country": "Panamá", "items": [\
{{"modality": "Monitor de Paciente", "quantity": 2, "brand": null, "model": null, "age_years": null}}, \
{{"modality": "Resonador Magnético (MRI)", "quantity": 1, "brand": null, "model": null, "age_years": 8}}, \
{{"modality": "Desfibrilador", "quantity": 1, "brand": "Philips", "model": null, "age_years": null}}]}}

Ejemplo 2 (descripción generada a partir de una foto del equipo):
Texto: "The image shows a medical device labeled PHILIPS, MRI Ingenia 1.5T, Model: 781340."
JSON: {{"customer": null, "city": null, "country": null, "items": [{{"modality": "Resonador \
Magnético (MRI)", "quantity": null, "brand": "PHILIPS", "model": "Ingenia 1.5T / 781340", \
"age_years": null}}]}}
"""


_NULLISH_STRINGS = {"", "null", "none", "n/a", "desconocido"}


def _clean(raw: dict, fields: list[str]) -> dict:
    out = {}
    for field in fields:
        value = raw.get(field)
        if isinstance(value, str) and value.strip().lower() in _NULLISH_STRINGS:
            value = None
        out[field] = value
    return out


def _normalize(raw: dict) -> dict:
    out = _clean(raw, VISIT_FIELDS)
    items = raw.get("items") if isinstance(raw.get("items"), list) else []
    cleaned = (_clean(i, ITEM_FIELDS) for i in items if isinstance(i, dict))
    out["items"] = [i for i in cleaned if any(v is not None for v in i.values())]
    return out


def _has_data(normalized: dict) -> bool:
    return bool(normalized["items"]) or any(normalized[f] is not None for f in VISIT_FIELDS)


def extract(text: str) -> dict:
    # ponytail: the model's first completion after a cold load occasionally
    # fails -- sometimes empty/truncated (invalid JSON), sometimes syntactically
    # valid JSON with every field null (both observed live, on separate runs).
    # Retry on either shape; a real backoff loop would be overkill here.
    for attempt in range(2):
        raw_text = qvac_client.extract_sync(text, JSON_SCHEMA, system_prompt=SYSTEM_PROMPT)
        try:
            raw = json.loads(raw_text)
            normalized = _normalize(raw if isinstance(raw, dict) else {})
            if _has_data(normalized):
                return normalized
        except (json.JSONDecodeError, TypeError):
            pass
        print(f"extract: attempt {attempt + 1} did not return usable fields, got: {raw_text!r}")
    return _normalize({})
