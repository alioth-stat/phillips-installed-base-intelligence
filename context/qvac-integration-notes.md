# QVAC SDK — integration notes from building the Philips challenge

Everything below was learned by reading the installed `tetherto.qvac_sdk`
Python package source directly and verifying against a real running worker —
not from public docs (the package's own docstrings and generated pydantic
schemas were more reliable than anything findable externally at the time).
If you're starting a **new** challenge with QVAC, read this before
re-deriving any of it; several of these are non-obvious and cost real
debugging time the first time around.

## The basic shape

```python
from tetherto.qvac_sdk import Client, load_model, completion
from tetherto.qvac_sdk import models as qvac_models

async with Client() as client:
    transport = client.transport
    model_id = await load_model(transport, model_src=qvac_models.QWEN3_1_7B_INST_Q4)
    run = completion(transport, model_id=model_id, history=[...], stream=False)
    text = await run.text()
```

Everything is `async`. `Client()` starts (or connects to) a local worker
process. `load_model` returns a `model_id` string you pass to every
subsequent call for that model.

## Model registry

`tetherto.qvac_sdk.models` has ~400 `ModelConstant`s (as of this writing).
Grep it for what you need rather than guessing names:

```python
from tetherto.qvac_sdk import models
[n for n in dir(models) if "WHISPER" in n]   # or QWEN, LLAMA, VISIONPSY, etc.
```

Models we used and why:
- **`QWEN3_1_7B_INST_Q4`** — general-purpose multilingual instruct LLM, used
  for structured extraction (Spanish + English both work fine). Fallback:
  `LLAMA_3_2_1B_INST_Q4_0`.
- **`WHISPER_SMALL_Q8_0`** — multilingual speech-to-text. There's also a
  dedicated `WHISPER_SPANISH_TINY_Q8_0` if you want smaller/faster at the
  cost of only Spanish.
- **`VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M`** + **`MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0`**
  — QVAC's own vision-language model (see "Multimodal / vision" below).
  460M params — it's small and genuinely inconsistent on OCR-style tasks
  (see the caveat later in this doc). English-trained; not validated for
  Spanish.
- **Don't use QVAC's "Psy" models for general text tasks.** `MedPsy` is
  English-only clinical Q&A, not tuned for JSON extraction. `VisionPsy` is
  the vision model, not a text model.

## Structured output (JSON extraction)

`completion()`'s `response_format` param does real GBNF-grammar-constrained
decoding — it's not just prompt-engineering, the token stream is
constrained to match your schema:

```python
run = completion(
    transport,
    model_id=llm_id,
    history=[{"role": "system", "content": "..."}, {"role": "user", "content": text}],
    stream=False,
    response_format={
        "type": "json_schema",
        "json_schema": {"name": "observation", "schema": YOUR_JSON_SCHEMA_DICT},
    },
)
text = await run.text()
```

This **guarantees syntactic validity** (every field, every type) but not
semantic correctness — the model can still legally emit `null` for
everything, or hallucinate a value for a field it should have left null.
The grammar restricts *which tokens are legal*, not *what the model chooses
to say*. Put real instructions in the system prompt too (e.g. "if a field
isn't mentioned, emit null — never guess"), and don't skip that step, we
did and got it right immediately.

**Cold-start flakiness (real, reproduced multiple times, not a one-off):**
the very first completion after loading a model sometimes comes back
malformed or with every field null, even for input that plainly contains
extractable info. Sometimes it's genuinely-invalid JSON; sometimes it's
syntactically-valid JSON that's just all-null. Build a retry that checks
**both**:

```python
for attempt in range(2):
    raw_text = ...  # call completion
    try:
        raw = json.loads(raw_text)
        if raw and any(v is not None for v in raw.values()):
            return raw
    except json.JSONDecodeError:
        pass
# fall through to an all-null/empty result after exhausting attempts
```

Checking only "is it valid JSON" is not enough — we shipped that first and
it still silently returned empty forms to users half the time.

## Transcription (speech-to-text)

```python
from tetherto.qvac_sdk import TranscribeRequest, transcribe

req = TranscribeRequest(
    modelId=whisper_id,
    type="transcribe",          # <-- see gotcha below, don't omit this
    audioChunk={"type": "filePath", "value": "/abs/path/to/audio.wav"},
)
parts = []
async for resp in transcribe(transport, req):
    if resp.text:
        parts.append(resp.text.strip())
    if resp.done:
        break
text = " ".join(parts)
```

**Concatenate the stream, don't keep the last response.** Each streamed
response is one Whisper *segment* (a few seconds of audio), not a growing
cumulative transcript. An earlier version of this snippet kept only
`resp.text` from the last iteration, which silently dropped everything but
the final ~4 seconds of a recording. The SDK's own `notebook.transcribe()`
concatenates the same way.

**Gotcha, cost real debugging time:** `TranscribeRequest.type` has a
pydantic default (`"transcribe"`), but the SDK serializes the wire payload
with `model_dump(exclude_unset=True)` — which drops any field you didn't
pass explicitly, *including one that matches its own default*. Omit `type=`
and the payload silently loses its routing discriminator; the worker then
replies with a plain (non-streaming) response instead of opening the
transcription stream, and the client raises `RuntimeError: expected a
response stream`. The fix is just to always pass `type="transcribe"`
explicitly. This class of bug (a field with a default that still needs to
be passed explicitly because of `exclude_unset`) may bite you elsewhere in
the SDK too if you construct a wire request object directly instead of
going through an ergonomic wrapper function — check whether a wrapper
(`load_model`, `completion`, etc.) exists before hand-building a request.

**Audio format:** `SupportedAudioFormat` only lists `.mp3 .m4a .ogg .wav
.flac .aac .raw` — **not** `.webm`. A browser's `MediaRecorder` defaults to
`audio/webm` (Opus). If you're capturing voice from a web frontend, you
must transcode server-side before handing the file to QVAC:

```python
subprocess.run(["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", out_path])
```

## Multimodal / vision (image → text)

A multimodal llama.cpp model is **two files**, not one: the base LLM
weights, plus a separate vision-projector ("mmproj") file. Load them
together via `model_config`:

```python
vlm_id = await load_model(
    transport,
    model_src=qvac_models.VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M,
    model_config={
        "projectionModelSrc": qvac_models.MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0.src,
        "ctx_size": 4096,
    },
)
```

**Pass `ctx_size`.** The worker defaults to a 1024-token context, and the
VLM re-tiles *every* image (even a 640px one) into up to 16 512px slices +
an overview at 64 tokens each, which overflows 1024 on its own:
`Request uses 1173 context units and leaves no room to generate within the
effective context capacity (1024 units)`. 4096 fits the image plus the
generated description.

There is no separate "load the projector" call — passing its `.src` string
under `model_config.projectionModelSrc` in the *same* `load_model()` call is
the whole mechanism. (We found this by grepping the SDK's generated pydantic
schema for `mmproj`/`projector`, not from any example code — it wasn't
obvious from `load_model`'s own signature or docstring.)

Attach an image to a completion via the history item's `attachments`:

```python
history=[{"role": "user", "content": "Describe this...", "attachments": [{"path": "/abs/path/to/image.jpg"}]}]
```

`attachments[].path` is a plain absolute file path — no base64 needed if
you're on the same machine as the worker.

**Real caveat, not hypothetical:** VisionPsy-Nano-460M is small and was
inconsistent in our testing. On one test photo it read "PHILIPS MRI Ingenia
1.5T Model: 781340" correctly and confirmed it. On a different photo with
equally legible text ("GE HEALTHCARE Ultrasound..."), it quoted the correct
text and then, in the same response, said "no brand name is visible" —
directly contradicting itself. Don't assume high reliability from this
model at this size; the extraction downstream should already null out
gracefully when it fails (ours does, via the retry logic above, and the
review-and-correct UI step everything else already needs anyway).

## Running QVAC calls from a sync web framework (FastAPI, Flask, etc.)

QVAC's Python API is entirely `async`. Two practical problems came up
wiring it into a synchronous request-handling framework:

1. **One event loop, reused for the process lifetime.** The RPC transport
   is bound to the event loop that created it. If you call
   `asyncio.run(...)` per-request (a new loop each time), the second call
   orphans the transport with `RuntimeError: RPC is closed`. Create one
   `asyncio.new_event_loop()` at module import time and drive every call
   through `loop.run_until_complete(...)` on that same loop, for the life
   of the process.
2. **That loop isn't thread-safe against concurrent requests.** A web
   framework can dispatch two requests on two different threads at the same
   moment (we hit this for real via a UI double-click); both trying
   `run_until_complete` on the same loop concurrently raises `RuntimeError:
   This event loop is already running`. Wrap calls in a
   `threading.Lock()` so concurrent requests queue instead of racing.

```python
_loop = asyncio.new_event_loop()
_lock = threading.Lock()

def run_sync(coro):
    with _lock:
        return _loop.run_until_complete(coro)
```

**In FastAPI specifically:** define routes that call into this as plain
`def` (not `async def`). FastAPI automatically runs synchronous route
handlers in a thread pool, which is exactly what you want here — it keeps
the blocking QVAC call off FastAPI's own event loop without you writing any
extra plumbing.

## Worker installation quirk (Linux, observed on this machine)

On some `npm`/`install-worker` layouts, `bare-runtime-*` gets hoisted to the
top-level `node_modules` instead of nesting under `@qvac/sdk`, so `Client()`'s
default path lookup misses the binary even though it's present. Fallback:

```python
from pathlib import Path
def find_hoisted_bare_binary():
    home = Path.home() / ".cache" / "qvac" / "worker"
    matches = sorted(home.glob("*/node_modules/bare-runtime-*/bin/bare"))
    return str(matches[-1]) if matches else None

try:
    client = Client()
except WorkerNotFoundError:
    bare_path = find_hoisted_bare_binary()
    client = Client(bare_path=bare_path) if bare_path else raise_original
```

## Reusing this repo's code for a different challenge

The Python modules at the repo root are QVAC-plumbing-agnostic where it
matters and can mostly be copied wholesale into a new challenge's repo:

- **`qvac_client.py`** — copy as-is. It's already generic (connect once,
  lazy-load whichever models you ask for, thread-safe). Swap the model
  constants for whatever your new challenge needs.
- **`api.py`** — the FastAPI wrapper pattern (plain `def` routes, thin,
  zero business logic of its own) is worth keeping; the routes themselves
  are Philips-specific and should be rewritten for the new domain.
- **`extract.py`** — the *pattern* (JSON schema + system prompt + retry
  loop) is reusable; the schema and prompt are Philips-specific.
- **`db.py`, `dedupe.py`, `confidence.py`** — Philips-domain-specific
  (equipment observations, corroboration). Useful as a reference for the
  *shape* of a solution (structured storage + fuzzy dedup + a confidence
  score), not as drop-in code, unless the new challenge is also
  "structured extraction with duplicate detection."
- **`frontend/src/components/Background.tsx`, `GlassPanel.tsx`,
  `StepShell.tsx`** — fully generic, reusable as-is for any sliding-wizard
  UI. `StepShell` takes an array of step panels and an index; swap in new
  step components for a different flow.
- **One React gotcha worth knowing before you hit it too:** `StepShell`
  keeps every step mounted at all times (that's what makes the slide
  transition possible). Any step component that reads a prop into
  `useState(prop)` or fetches data in a mount-only `useEffect` will only do
  that once, at t=0, before real data exists — and never again. We hit this
  twice (a review form that stayed empty forever, a panel that never showed
  a freshly-saved row) before recognizing the pattern. Fix: give the parent
  a per-step key that bumps exactly when a step should mount fresh, and
  pass `key={...}` on that step element so React remounts it instead of
  reusing the stale instance.
