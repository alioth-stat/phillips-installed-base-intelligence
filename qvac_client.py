"""Thin sync wrapper around the QVAC SDK: connect once, load models once, reuse."""
import asyncio

from tetherto.qvac_sdk import (
    Client,
    TranscribeRequest,
    WorkerNotFoundError,
    completion,
    load_model,
    transcribe,
)
from tetherto.qvac_sdk import models as qvac_models

_state: dict = {"client": None, "llm_id": None, "whisper_id": None}

_WORKER_HINT = (
    "QVAC worker not found. Run `python -m tetherto.qvac_sdk install-worker` "
    "in this repo's venv, then retry."
)


async def _connect_and_load() -> None:
    if _state["client"] is None:
        client = Client()
        await client.connect()
        _state["client"] = client

    transport = _state["client"].transport

    if _state["llm_id"] is None:
        try:
            _state["llm_id"] = await load_model(transport, model_src=qvac_models.QWEN3_1_7B_INST_Q4)
        except Exception:
            _state["llm_id"] = await load_model(transport, model_src=qvac_models.LLAMA_3_2_1B_INST_Q4_0)

    if _state["whisper_id"] is None:
        _state["whisper_id"] = await load_model(transport, model_src=qvac_models.WHISPER_SMALL_Q8_0)


def ensure_ready_sync() -> None:
    if _state["llm_id"] is not None and _state["whisper_id"] is not None:
        return
    try:
        asyncio.run(_connect_and_load())
    except WorkerNotFoundError as e:
        raise RuntimeError(_WORKER_HINT) from e
    except Exception as e:
        raise RuntimeError(f"QVAC setup failed: {e}") from e


async def _extract(text: str, json_schema: dict, system_prompt: str | None) -> str:
    transport = _state["client"].transport
    history = []
    if system_prompt:
        history.append({"role": "system", "content": system_prompt})
    history.append({"role": "user", "content": text})
    run = completion(
        transport,
        model_id=_state["llm_id"],
        history=history,
        stream=False,
        response_format={"type": "json_schema", "json_schema": {"name": "observation", "schema": json_schema}},
    )
    return await run.text()


def extract_sync(text: str, json_schema: dict, system_prompt: str | None = None) -> str:
    ensure_ready_sync()
    try:
        return asyncio.run(_extract(text, json_schema, system_prompt))
    except Exception as e:
        raise RuntimeError(f"QVAC completion failed: {e}") from e


async def _transcribe(audio_file_path: str) -> str:
    transport = _state["client"].transport
    req = TranscribeRequest(modelId=_state["whisper_id"], audioChunk={"type": "filePath", "value": audio_file_path})
    last_text = ""
    async for resp in transcribe(transport, req):
        if resp.text:
            last_text = resp.text
    return last_text or ""


def transcribe_sync(audio_file_path: str) -> str:
    ensure_ready_sync()
    try:
        return asyncio.run(_transcribe(audio_file_path))
    except Exception as e:
        raise RuntimeError(f"QVAC transcription failed: {e}") from e
