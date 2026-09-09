# Running this app on-device on Android (Termux)

The hackathon's hard rule is that inference has to run on-device or
peer-to-peer via QVAC — never a cloud LLM call, and this is verified before
judging. To actually demonstrate that on a phone (the app's real users are
field reps carrying a phone, not a laptop), the demo has to run inference on
the phone's own hardware, not just show the phone's browser talking to a
server somewhere else.

## Why Termux, not a wrapped web app

Two easier-looking options don't actually satisfy the rule:

- **Wrapping the existing web app** (Capacitor, Cordova, a PWA, or a tunnel
  like `cloudflared` pointed at a desktop-hosted backend) makes the app
  *look* native, but inference still runs wherever the FastAPI backend is
  hosted — the phone is just a remote screen. That's not on-device.
- **A full native rewrite** (Expo/React Native embedding `@qvac/sdk`
  directly) genuinely would be on-device, but it's a different app, not this
  one — see "Future work" below.

**Termux** is a real Linux userland running on the phone's own hardware. It
can run this repo's existing Python/Node/`ffmpeg` stack completely unmodified
— no rewrite, no tunnel, no remote server. The QVAC worker's native
GGML/llama.cpp/whisper.cpp code executes on the phone's own ARM CPU, exactly
like it does on a desktop today.

## Setup

1. Install Termux from **F-Droid**, not the Play Store — the Play Store build
   is stale and missing packages this needs.
2. Install the toolchain:
   ```
   pkg install python nodejs-lts ffmpeg clang git
   ```
   `clang` is there because some Python dependencies may need to build a C
   extension under Termux's bionic libc rather than pull a prebuilt
   manylinux wheel.
3. Get the repo onto the phone — `git clone` if the repo has a remote
   reachable from the phone, otherwise `termux-setup-storage` and copy it in.
4. Install Python deps:
   ```
   pip install -r requirements.txt
   ```
   If `pandas` gives trouble building here, it's safe to drop for this path —
   it's only imported by the Streamlit fallback UI (`app.py`), not by
   anything on the FastAPI (`api.py`) route this demo uses.
5. Install the QVAC worker, same command already used on desktop:
   ```
   python -m tetherto.qvac_sdk install-worker
   ```
   See "Known risk" below before assuming this just works.
6. Run the app, same as on desktop:
   ```
   ./run.sh
   ```
7. Open the phone's **own** browser to `http://localhost:5173`. Because the
   browser and the server are on the same device, this is automatically a
   secure context — camera and microphone permissions work with zero HTTPS
   tunnel setup, unlike testing from a *different* phone against a
   LAN-hosted dev server.

## Known risk: worker install may resolve the wrong native prebuild

`tetherto.qvac_sdk install-worker` drives an `npm install` that picks the
right native `.node`/`.so` binary for the worker's dependencies
(`bare-runtime`, `sodium-native`, etc.) based on npm's platform-gated
`optionalDependencies`. Those packages do ship real `android-arm64` /
`android-arm` prebuilds — but Termux's Node reports
`process.platform === 'linux'`, not `'android'`, since Termux presents itself
to Node as a standard Linux target. npm's os-matching may therefore resolve
the generic `linux-arm64` prebuild instead of the Android one, which won't
run correctly against Android's bionic libc (or will fail to load at all).

**Symptom to watch for**: `install-worker` completes without error, but
`Client()` fails at connect time, or the worker process crashes immediately
on start.

**Fix**: force the correct Android prebuild manually rather than trusting
npm's auto-detection — e.g. `npm_config_target_platform=android npm install`
in the worker's install directory, or manually swapping in the
`android-arm64` prebuild binary in place of whatever `linux-arm64` one got
selected. This can't be verified without a physical device to test against;
treat it as the first thing to debug if the worker won't start under Termux.

## What this proves

A rep, on their own phone, with no network dependency for inference: opens
the app, records or types an observation, and gets structured extraction
back — with the model actually running on that phone's CPU the entire time.

## Future work: a real native Android app

For a shippable Play Store app (not built in this pass), the real answer is
a separate Expo/React Native app embedding `@qvac/sdk` directly via
`react-native-bare-kit`, rather than anything wrapping this React/FastAPI
app. `@qvac/sdk` ships genuine Android support for this: Expo config plugins
(`withQvacSDK.js`, `withAndroidArchitecture.js`, `withMobileBundle.js`) that
set `minSdkVersion 29`, target `arm64-v8a`, and link Bare into the app
process so inference runs in-process on the phone — this is the same
mechanism as the Termux path above, just packaged as a native app instead of
a Linux userland.

**Caveat**: `@qvac/sdk`'s own docs
(`node_modules/@qvac/sdk/docs/system-resources-support-matrix.md` in the
installed worker) note the Android target has no physical-device QA
sign-off yet as of this SDK version. Treat the Android path as
architecturally real (the native builds and config plugins exist and are
not stubs) but functionally unproven until tested on real hardware.

**Reusable as-is** — the domain logic doesn't care what UI framework calls
it:
- `extract.py`'s JSON schema and Spanish system prompt (port the strings to
  TS, the grammar-constrained decoding call is the same shape via
  `@qvac/sdk`'s JS API).
- `taxonomy.csv` — just data.
- `confidence.py`'s scoring formula — a few lines of arithmetic.
- The visual/interaction language (glass surface, dither parallax, the step
  wizard) as a *design reference*, not literal code — React DOM and Tailwind
  don't carry over to React Native. `expo-blur` covers the glass surface,
  `react-native-reanimated` the step-slide/parallax.

**Needs rebuilding**:
- All UI (React DOM components → React Native components).
- Audio capture — there's no `ffmpeg` subprocess available on-device, so the
  current MediaRecorder → `ffmpeg` → QVAC transcribe path has no direct
  mobile equivalent and needs a different approach.
- Photo capture — `expo-image-picker` in place of the browser file input.
- Storage — `expo-sqlite` in place of the FastAPI + `sqlite3` layer
  entirely, since everything becomes in-process JS calls with no HTTP API
  to speak of.
