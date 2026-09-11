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


@app.post("/api/photo")
def post_photo(photo: UploadFile):
    with tempfile.TemporaryDirectory() as tmp:
        in_path = Path(tmp) / "input"
        img_path = Path(tmp) / "photo.jpg"
        in_path.write_bytes(photo.file.read())
        # ponytail: the VLM re-tiles every image into 512px slices anyway (a
        # 640px and a 4032px photo both became 12-16 slices, observed live),
        # so extra pixels buy nothing -- normalize any size/format ffmpeg
        # decodes (huge phone photos, webp, png w/ alpha) to a <=1024px JPEG.
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(in_path), "-frames:v", "1", "-q:v", "3",
             "-vf", "scale=1024:1024:force_original_aspect_ratio=decrease:force_divisible_by=2",
             str(img_path)],
            capture_output=True,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"No se pudo leer la imagen: {result.stderr.decode(errors='replace')[-300:]}")
        try:
            description = qvac_client.describe_image_sync(str(img_path))
            fields = extract.extract(description)
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
    return {"description": description, "fields": fields}


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
