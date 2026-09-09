"""FastAPI wrapper around the existing modules -- no business logic lives here.
Routes are plain `def` (not `async def`) so FastAPI runs the blocking
QVAC/sqlite calls in its threadpool automatically.
"""
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import confidence
import db
import dedupe
import extract
import qvac_client

app = FastAPI(title="Philips Installed Base Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

conn = db.init_db()


class ExtractRequest(BaseModel):
    text: str


class ObservationIn(BaseModel):
    customer: str | None = None
    city: str | None = None
    country: str | None = None
    modality: str | None = None
    brand: str | None = None
    model: str | None = None
    quantity: int | None = None
    age_years: float | None = None
    source_text: str = ""


@app.get("/api/taxonomy")
def get_taxonomy(category: str):
    return db.get_taxonomy(conn, category)


@app.post("/api/extract")
def post_extract(body: ExtractRequest):
    try:
        return extract.extract(body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/api/transcribe")
def post_transcribe(audio: UploadFile):
    # ponytail: browser MediaRecorder outputs webm/opus, which QVAC's
    # SupportedAudioFormat does not list (mp3/m4a/ogg/wav/flac/aac/raw only)
    # -- transcode is required, not optional.
    with tempfile.TemporaryDirectory() as tmp:
        in_path = Path(tmp) / "input"
        out_path = Path(tmp) / "audio.wav"
        in_path.write_bytes(audio.file.read())
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(in_path), "-ar", "16000", "-ac", "1", str(out_path)],
            capture_output=True,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"ffmpeg transcode failed: {result.stderr.decode(errors='replace')[-500:]}")
        try:
            text = qvac_client.transcribe_sync(str(out_path))
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
    return {"text": text}


@app.post("/api/observations")
def post_observation(body: ObservationIn):
    nuevo = body.model_dump()
    existentes = db.get_all_observations(conn)
    duplicado = dedupe.find_duplicate(nuevo, existentes)
    if duplicado:
        score, status = confidence.compute_confidence(nuevo, duplicado["corroboration_count"] + 1)
        db.update_corroboration(conn, duplicado["id"], score, status)
        return {"duplicate": True, "id": duplicado["id"], "status": status, "confidence": score}

    score, status = confidence.compute_confidence(nuevo)
    nuevo["confidence"] = score
    nuevo["status"] = status
    new_id = db.insert_observation(conn, nuevo)
    return {"duplicate": False, "id": new_id, "status": status, "confidence": score}


@app.get("/api/observations")
def list_observations():
    return db.get_all_observations(conn)
