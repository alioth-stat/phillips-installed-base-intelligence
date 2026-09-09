## QVAC platform specifics

QVAC is Tether Data's open-source, local-first AI SDK and model ecosystem for running inference entirely on-device or peer-to-peer, with no cloud calls, no API keys, and no rate limits. The core SDK repository is [tetherto/qvac](https://github.com/tetherto/qvac) (594 stars, 111 forks, 95 open issues, actively updated as of September 2026), described as "Open-source local AI SDK - run AI on-device with no cloud, no API keys," supporting GGUF models, RAG, image/music/video generation, speech-to-text, and P2P inference across Linux, macOS, Windows, Android, and iOS. Installed via `npm install @qvac/sdk` (JS/TS) or the `tetherto.qvac_sdk` Python package, it exposes a single unified function-call API — `loadModel()` / `unloadModel()`, then task calls like `completion()`, `embed()`, transcription, translation, OCR, and vision — rather than a REST server; the same code runs on phone, laptop, or server. **Verdict: fits perfectly** — it is the mandated on-device runtime and its `loadModel` call accepts any GGUF (curated registry, raw Hugging Face URL, or local file), which is exactly what's needed to run an extraction LLM and Whisper together in one process.[^1]

Model-wise, QVAC's "Psy" family under the `qvac` Hugging Face org includes three specialized lines: **VisionPsy-Nano** (the VLM from the hackathon promo), **MedPsy** (text-only medical LLMs), and **TranslatePsy** (offline machine translation for European and African languages). VisionPsy-Nano-460M is a ~460M-parameter vision-language model (SigLIP2 encoder + SmolLM2-360M backbone) built on nanoVLM, released July 29, 2026 under Apache 2.0, with an 8,192-token context, native 512×512 image handling (tiling to 2048px), and a low-latency "Flash" variant using 64 visual tokens instead of 1,088 for near real-time first-token latency (0.3s on iPhone 15). It leads its ~0.5B weight class on 16 of 17 public multimodal benchmarks, including document/OCR understanding, but is trained and evaluated primarily in English — Spanish is not officially validated. MedPsy-1.7B/4B are text-only medical-reasoning LLMs, also Apache 2.0 and GGUF-quantized, but likewise English-only and unsuited to structured JSON extraction of asset metadata since they are tuned for clinical Q&A, not schema-constrained output. Critically, the SDK's `loadModel()` also accepts *any* GGUF model — including general LLMs like Llama 3.2 or Qwen — from Tether's registry, a raw Hugging Face URL, or a local file, and the SDK task list explicitly includes "Text generation: Chat, completion and **structured output**" and "Transcription: Speech-to-text, fully on-device" via Whisper. **Verdict:** for this project, skip VisionPsy-Nano (no audio input, English-only, and the observation is text/voice, not an image) and instead load a small general-purpose instruction-tuned GGUF (e.g., Llama-3.2-1B-Instruct or Qwen2.5-1.5B-Instruct, both multilingual-capable) through the SDK's structured-output path for the extraction step, and use the SDK's bundled Whisper transcription task for voice capture — both run through the same `@qvac/sdk` install with no extra runtime.[^2][^3][^4][^5][^1]

Starter kits and examples come from [tetherto/qvac-examples](https://github.com/tetherto/qvac-examples) (official, small but current) and a much richer community set: [patilswapnilv/qvac-cookbook](https://github.com/patilswapnilv/qvac-cookbook) offers runnable TypeScript recipes for streaming, RAG, speech, translation, and tool calling; [thomasblc/qvac-playground](https://github.com/thomasblc/qvac-playground) is a browser UI exercising every SDK capability (chat, TTS, STT, translate, VLM, OCR, RAG) and can be forked directly as a capture/browse shell. Tether's own site lists ten official "recipes," two of which map almost one-to-one onto this challenge: "Natural language to SQL" (turns plain-English questions into SQL against a local database) and "Invoice manager" (extracts structured data from invoices/receipts using local vision+language models) — both are strong templates to fork for the extraction-to-database pipeline. **Verdict: qvac-cookbook and the invoice-manager/NL-to-SQL recipes are the best starting points**; clone and adapt rather than build the SDK plumbing from scratch.[^1]

Known limitations to plan around: VisionPsy-Nano is single-image, English-first, and not meant for safety-critical decisions; MedPsy is English-only and text-only; and while `loadModel` supports "any GGUF," multilingual quality (needed since field reps may report in Spanish) depends entirely on which base LLM is chosen — Qwen2.5/3 and Llama-3.x families have solid Spanish support, unlike the QVAC-native Psy models. SDK-native structured output/function-calling is listed as a supported task category, but its constraint mechanism (grammar vs. simple JSON-mode prompting) isn't detailed in public docs, so plan to fall back to grammar-constrained decoding at the llama.cpp layer if the SDK's built-in structured output proves unreliable at nano scale. Latency on typical laptop hardware should be favorable given VisionPsy-Nano-Flash reaches sub-3-second first tokens even on phones; a 1-3B GGUF LLM on a modern laptop CPU/GPU should comfortably transcribe+extract a short field note in a few seconds.[^3][^5][^2][^1]

## On-device speech-to-text (voice capture)

| Option | Size | Spanish support | Streaming | License | Verdict |
|---|---|---|---|---|---|
| Whisper / whisper.cpp | 75MB (tiny) – 3GB (large-v3) | Excellent, high-resource language (3-8% WER)[^6][^7] | Not native; forks add it | MIT | Best accuracy; bundled by QVAC SDK itself |
| faster-whisper (CTranslate2) | Same weights, 4-5x faster, ~50% less RAM | Same as Whisper, "excellent" for Spanish[^8] | Partial | MIT | Best if running outside the QVAC process on CPU |
| Vosk (Kaldi) | 40MB–1.8GB per language | Good, 20+ languages incl. Spain/LatAm variants[^7][^9] | Yes, native, <200ms latency | Apache 2.0 | Best for ultra-low-resource/embedded, not needed here |

Because the QVAC SDK already lists "Transcription: Speech-to-text, fully on-device" as a built-in task and its `loadModel()` explicitly accepts Whisper as a supported model format, the simplest and most demo-friendly path is to load a Whisper GGUF (small or medium, multilingual) directly through the SDK rather than standing up a separate whisper.cpp or faster-whisper process — this keeps the whole pipeline in one runtime and avoids extra dependencies. Whisper's WER for Spanish is in the 3–8% range on clean audio, which is more than adequate for short spoken field notes, and it uses the standard `-l es` (or `auto`) language flag. **Verdict: use QVAC's built-in Whisper transcription task; only reach for standalone faster-whisper (MIT, 4-5x faster on CPU) if the SDK's bundled implementation proves too slow on the demo laptop.** Vosk is a fallback for constrained hardware but is unnecessary given a laptop demo environment.[^6][^10][^11][^1]

## Structured extraction with a small local LLM

Two complementary approaches exist for reliable JSON extraction from a small on-device model: prompt-only few-shot extraction, and grammar/schema-constrained decoding. At nano scale (under ~2B parameters), few-shot prompting alone is unreliable for consistently valid, schema-conforming JSON with optional/missing fields — constrained decoding is strongly recommended as a safety net. `llama.cpp` — the inference engine underlying most GGUF runtimes, including QVAC's on-device backend — natively supports GBNF grammars and can auto-convert a JSON Schema into a grammar via `--json-schema` or the server's `json_schema` response-format field, guaranteeing that every generated token is valid according to the schema. This means fields, types, `required`, `enum`, and array constraints (useful for status tags like Confirmed/Reported/Estimated/Unknown) can be enforced at decode time with no post-hoc JSON repair.[^12][^13][^14][^15][^16]

On top of that raw grammar mechanism, two popular Python libraries add ergonomics: [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines) (Apache 2.0, actively maintained, v1.3.3 as of August 2026) supports Transformers, llama.cpp, vLLM, and MLX backends and lets you pass a Pydantic model directly as the desired output type, guaranteeing schema-valid JSON via FSM-based constrained generation. [567-labs/instructor](https://github.com/567-labs/instructor) (MIT, ~13-15k stars, 3M+ monthly downloads) takes a validate-and-retry approach — wrap a client, pass a Pydantic `response_model`, and it retries on validation failure — and explicitly supports `llama-cpp-python` and Ollama as local backends. Since QVAC's SDK is JS/TS-first (with a Python client too), the most demo-robust path is to define the observation schema as a JSON Schema, hand it to `llama.cpp`'s grammar conversion (or Outlines if working from Python against a llama.cpp/Transformers backend), and treat the SDK's native "structured output" completion mode as the first attempt with a schema-to-grammar fallback if it isn't strict enough. **Verdict: don't rely on prompting alone — wire in JSON-schema-to-GBNF constrained decoding (native to the llama.cpp engine QVAC runs on) as the reliability backbone, optionally via Outlines for cleaner Python ergonomics.**[^16][^17][^18][^19][^20][^21][^22][^1]

For handling *missing* fields specifically, define the schema with all extraction fields as nullable/optional and instruct the model (in the system prompt, not just the grammar) to emit `null` rather than guess — the grammar guarantees syntactic validity, but the prompt still needs to steer semantic behavior, since a grammar only restricts *which* tokens are legal, not what the model chooses to say.[^16]

## Duplicate detection

[rapidfuzz](https://github.com/rapidfuzz) is the clear choice for this project: an MIT-licensed, actively maintained, SIMD-accelerated C++ rewrite of FuzzyWuzzy's scoring functions with a fully compatible Python API, roughly 20-40x faster than the older FuzzyWuzzy/TheFuzz on identical workloads. Its `process.cdist` function scores all pairs between two lists in one call — ideal for comparing a new observation's (hospital, city, equipment type, brand) tuple against all stored records to flag likely duplicates, and it needs no training data or internet access. [dedupeio/dedupe](https://github.com/dedupeio/dedupe) (MIT license, 4.2k stars) is a heavier alternative offering a full active-learning record-linkage pipeline — automatic blocking, clustering, canonicalization — but it requires labeling 20-50 sample pairs interactively to train the matcher, which is more setup than a 48-hour prototype needs. **Verdict: use rapidfuzz for a lightweight weighted composite-key fuzzy match (e.g., `token_sort_ratio` on normalized hospital name + city + modality + brand, thresholded at ~85%) as the duplicate flag; skip dedupe.io unless there's spare time to build the training set.**[^23][^24][^25]

## Data storage and equipment taxonomy

For a 48-hour prototype, SQLite is the sensible default: zero-config, file-based, ships with Python's standard library, supports the relational structure needed for a `status` enum column per observation plus straightforward aggregation queries (`GROUP BY customer`, `GROUP BY modality`) for the per-customer and cross-customer views. DuckDB is worth considering only if the team wants fast in-process analytical (OLAP-style) rollups across many observations, but for a demo-scale dataset SQLite's simplicity outweighs any performance benefit. A flat JSON/CSV store is viable for the very first hours of prototyping but becomes awkward once duplicate-detection queries and per-customer aggregation are needed, so migrating to SQLite early is worth the small time cost.

Rather than inventing an equipment taxonomy, borrow an existing medical-device nomenclature. The most relevant options are:

- **GMDN (Global Medical Device Nomenclature)**: a live, internationally maintained nomenclature where every device type gets a unique 5-digit code, a name, and a clinically oriented definition; used globally for regulatory device identification.[^26]
- **UMDNS (Universal Medical Device Nomenclature System)**: the predecessor nomenclature, also 5-digit codes with definitions, organized in a multi-hierarchical classification, free for non-commercial use.[^26]
- **AccessGUDID (FDA's Global Unique Device Identification Database)**: a free, downloadable, US-government-maintained database of 4.3 million real medical devices, each mapped to a GMDN term, available via bulk download or API.[^27][^28][^26]

**Verdict:** pull a subset of GMDN/UMDNS terms (or directly query AccessGUDID's free API/download) to pre-populate a "modality/equipment type" and "brand/model" reference table — this alone removes the need to hand-build a device taxonomy and gives the demo real-world credibility with recognizable device categories (e.g., "Infusion Pump," "Patient Monitor," "MRI System").

## UI shell

| Option | Setup speed | Best fit | Verdict |
|---|---|---|---|
| Streamlit | ~5 min setup, handles multi-page flows well[^29] | Capture form + browse/aggregate dashboard in one app | **Recommended** — Python-native, pairs directly with a Python QVAC client and SQLite, fastest path to a demoable per-customer/cross-customer view |
| Gradio | ~2 min setup, best for single-function demos[^29] | Quick "type/speak → structured JSON" demo widget | Good secondary choice if the demo centers on one live extraction call rather than a full app |
| Minimal React/Next | Slower to bootstrap in 48h | Needed if QVAC's JS/TS SDK is used directly in-browser | Only worth it if leveraging QVAC's native JS SDK for true in-browser/P2P inference without a Python backend |
| Bare CLI/chat | Fastest to code, worst to demo on video | Internal testing only | Not recommended for a video-judged hackathon submission |

Given QVAC ships both JS/TS and Python bindings equally, and the extraction/dedup/storage logic (rapidfuzz, SQLite, llama.cpp Python bindings, GMDN lookups) is most naturally Python, Streamlit is the fastest way to glue everything into one demoable app: a capture tab (voice/typed input → Whisper → LLM extraction → follow-up prompts for missing fields) and a browse tab (per-customer table, cross-customer pivot by modality/brand), both querying the same SQLite file. [thomasblc/qvac-playground](https://github.com/thomasblc/qvac-playground) remains a good JS/TS reference if the team decides to lean into the browser-native QVAC SDK instead.

## Prior art and adjacent open-source projects

Several QVAC-hackathon-era and general open-source repos map closely onto pieces of this problem:

- [Faadil1/edgevoc-qvac](https://github.com/Faadil1/edgevoc-qvac) — "Private offline customer-feedback analysis powered by the QVAC SDK," actively updated (September 2026); close analog for voice-note-to-structured-insight extraction on QVAC.
- [zcy0109/qvac-localvault-ai](https://github.com/zcy0109/qvac-localvault-ai) — a "local-first confidential document intelligence workspace" built on the QVAC SDK; useful reference for local document/record storage patterns.
- [ryonzhang/qvac-portfolio-scout](https://github.com/ryonzhang/qvac-portfolio-scout) — a 4-agent local pipeline on QVAC combining RAG and P2P; useful architectural reference for a multi-step (extract → dedupe-check → confirm) local agent flow.
- [r0bops/faraday-qvac](https://github.com/r0bops/faraday-qvac) — an offline field-reporting companion built on QVAC and Whisper for journalists in crisis zones; directly analogous field-voice-capture use case.
- [msupply-foundation/mobile](https://github.com/msupply-foundation/mobile) — an established, offline-first open-source mobile app for medical inventory control used in developing countries; a strong reference (though not QVAC-based) for the data model and UX of tracking medical stock/equipment across facilities.[^30]
- [openboxes/openboxes](https://github.com/openboxes/openboxes) (Apache 2.0) — a mature open-source warehouse/supply-chain management system purpose-built for healthcare facilities; useful for borrowing its facility/inventory data model rather than the whole app.[^31][^32]
- Tether's official "Natural language to SQL" and "Invoice manager" recipes — the closest official templates for "chat-to-structured-database," worth forking directly as the extraction-and-storage skeleton.[^1]

**Verdict:** none of these are complete drop-in solutions for the exact Philips brief, but `edgevoc-qvac` and `faraday-qvac` are the closest QVAC-native analogs for voice-to-structured capture, and `msupply-foundation/mobile`/`openboxes` are useful for borrowing a sane facility/equipment data model rather than designing one from scratch.

## Confidence scoring

Rather than inventing a novel scoring method, standard data-quality literature offers a simple, explainable weighted-completeness formula that fits this use case well: assign each schema field a weight, compute the fraction of populated high-value fields (completeness), and combine it with a corroboration bonus for how many independent observations agree on the same customer+equipment record. A defensible formula:[^33][^34][^35]

\[
\text{Confidence} = w_1 \times \text{Completeness} + w_2 \times \min(1, \text{CorroborationCount} / N)
\]

where Completeness is the fraction of required fields (customer, city, country, modality, brand, model) that are non-null, CorroborationCount is the number of independent observations that match on the fuzzy-dedup key, N is a saturation threshold (e.g., 3 corroborating reports maxes out the bonus), and \(w_1, w_2\) sum to 1 (a reasonable default is 0.7/0.3, mirroring industry data-quality scorecards that weight completeness most heavily). This score can then be bucketed into the four status tags: above ~0.85 with at least one corroboration maps to Confirmed, above ~0.6 completeness alone maps to Reported, low completeness but present maps to Estimated, and near-zero maps to Unknown. This mirrors common practice: enterprise data-quality tools compute an overall score as a weighted average of dimension scores (completeness, validity, uniqueness, etc.), which is the same non-ML, fully explainable pattern applicable here.[^35][^36][^33]

## Summary recommendation

None of the components above requires a cloud API key or network call once weights are downloaded locally, satisfying the challenge's on-device/peer-to-peer constraint, provided the extraction LLM is a general small GGUF (not the English-only, non-JSON-tuned QVAC Psy models) loaded through the QVAC SDK's own `loadModel()`/completion path, paired with QVAC's bundled Whisper transcription, llama.cpp/Outlines-style JSON-schema-constrained decoding for reliability, rapidfuzz for dedup, SQLite plus a GMDN/UMDNS-derived taxonomy for storage, and a Streamlit shell wrapping it all for a fast, video-ready demo.[^17][^23][^27][^16][^1]

---

## References

1. [SDK - QVAC by Tether](https://qvac.tether.io/dev/sdk/) - A single API for local, decentralized AI. Run text, vision, audio and fine-tuning on the devices you...

2. [Tether releases 460M-parameter VisionPsy-Nano models ...](https://runtimewire.com/article/tether-qvac-visionpsy-nano-on-device-vision-models) - Tether's QVAC group released open-weight 460M-parameter VisionPsy-Nano models for mobile image under...

3. [VisionPsy-Nano: Entity, Sources, Concepts and Comparisons](https://getllms.org/entities/visionpsy-nano) - The ultimate directory of Large Language Models. Search, filter, and compare AI models.

4. [qvac/VisionPsy-Nano-460M](https://huggingface.co/qvac/VisionPsy-Nano-460M) - VisionPsy-Nano-460M is a compact (~460M parameter) vision-language model built for on-device and edg...

5. [Models - QVAC by Tether](https://qvac.tether.io/models/) - All MedPsy models are available in the Hugging Face collection: The collection includes the full-pre...

6. [Whisper Statistics 2026 - ChromeOSphere](https://chromeosphere.com/whisper-statistics-2026/) - OpenAI Whisper recorded 4.1 million monthly downloads on Hugging Face as of December 2025, establish...

7. [Vosk vs Whisper local: guía 2026 para reconocimiento de voz (STT ...](https://www.sinologic.net/2026-05/vosk-vs-whisper-local-stt-2026.html) - Hace un tiempo, un cliente me pidió una mejora en su sistema para que su Asterisk pudiera pedir medi...

8. [Mejores Modelos Open Source de Voz a Texto (STT)](https://www.javadex.es/blog/mejores-modelos-open-source-voz-a-texto-stt-2026) - Whisper, faster-whisper, faster-whisper -- 4x mas rapido. Vosk -- modelos de 50 MB, funciona offline...

9. [Vosk vs Whisper Local: The Ultimate 2026 Guide to Self ...](https://www.sinologic.net/en/2026-05/vosk-vs-whisper-local-the-ultimate-2026-guide-to-self-hosted-speech-recognition-stt.html) - Vosk vs Whisper local: quick comparison ; Accuracy on clean audio, Good, Excellent ; Accuracy with n...

10. [speaking in foreign language #242 - ggml-org whisper.cpp - GitHub](https://github.com/ggml-org/whisper.cpp/discussions/242) - You need to define the language, add "-l es" for Spanish. Btw the original Python version does the l...

11. [How To Run Whisper.cpp Offline For Multilingual Meeting ...](https://gradeonetools.com/more/how-to-run-whisper-cpp-offline-for-multilingual-meeting-transcripts-without-internet-dependency) - Step-by-step guide to running Whisper.cpp offline for accurate, multilingual meeting transcripts—no ...

12. [GitHub - llama.cpp grammars](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md) - LLM inference in C/C++. Contribute to ggml-org/llama.cpp development by creating an account on GitHu...

13. [llama.cpp/tools/server/README.md at master · ggml-org ... - GitHub](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) - LLM inference in C/C++. Contribute to ggml-org/llama.cpp development by creating an account on GitHu...

14. [Constrained Decoding | GenAI Mindmap](https://genai4a11.github.io/concepts/constrained-decoding.html) - Techniques that guide token-level generation to produce structured outputs (JSON, SQL, regex pattern...

15. [Generating Structured Outputs from Language Models](https://arxiv.org/html/2501.10868v1)

16. [Structured Output - Liquid Docs](https://docs.liquid.ai/deployment/on-device/llama-cpp/structured-output)

17. [Welcome to Outlines!](https://dottxt-ai.github.io/outlines/latest/) - Outlines guarantees structured outputs during generation — directly from any LLM. Works with any mod...

18. [SKILL.md - NousResearch/hermes-agent - GitHub](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/mlops/instructor/SKILL.md) - The agent that grows with you. Contribute to NousResearch/hermes-agent development by creating an ac...

19. [instructor/docs/index.md at main](https://github.com/jxnl/instructor/blob/main/docs/index.md) - Instructor is a Python library that extracts structured, validated data from Large Language Models (...

20. [GitHub - dottxt-ai/outlines: Structured Text Generation](https://github.com/dottxt-ai/outlines/tree/main) - Structured Text Generation. Contribute to dottxt-ai/outlines development by creating an account on G...

21. [Instructor — Intermediate Documentation (Free) | THE D*AI*LY BRIEF](https://www.beri.net/learning/instructor-structured-outputs-docs) - Instructor's documentation teaches the pattern most production LLM code eventually converges on: dec...

22. [Outlines structured generation library for LLMs - HeyClaude](https://heyclau.de/entry/tools/outlines) - Outlines is an open-source Python library for structured LLM generation that guarantees outputs matc...

23. [Fuzzy Matching in Python: FuzzyWuzzy vs RapidFuzz vs Dedupe ...](https://dedupfuzzy.com/blog/fuzzy-matching-python-fuzzywuzzy-rapidfuzz-dedupe) - Dedupe is a different kind of library. RapidFuzz gives you similarity scores. Dedupe gives you a ful...

24. [GitHub - dedupeio/dedupe: :id: A python library for accurate and ...](https://github.com/dedupeio/dedupe) - Dedupe.io also supports record linkage across data sources and continuous matching and training thro...

25. [dedupe/README.md at main · dedupeio/dedupe](https://github.com/dedupeio/dedupe/blob/main/README.md) - :id: A python library for accurate and scalable fuzzy matching, record deduplication and entity-reso...

26. [Medical Device Nomenclature - What Next Globally?](https://www.gmdnagency.org/wp-content/uploads/2024/08/GMDN-white-paper_Medical-Device-Nomenclature-GMDN-website-version.pdf)

27. [AccessGUDID](https://accessgudid.nlm.nih.gov/) - The Global Unique Device Identification Database (GUDID) contains key device identification informat...

28. [Schema](https://accessgudid.nlm.nih.gov/download/schema) - The Global Unique Device Identification Database (GUDID) contains key device identification informat...

29. [Streamlit vs. Gradio in 2026: Build AI Prototypes 3x Faster](https://markaicode.com/vs/streamlit-vs-gradio-in/) - Choose the right Python framework for GPT-5 apps. Compare Streamlit and Gradio for deployment speed,...

30. [GitHub - msupply-foundation/mobile: Open source mobile app for medical inventory control](https://github.com/msupply-foundation/mobile) - Open source mobile app for medical inventory control - msupply-foundation/mobile

31. [OpenBoxes is a warehouse management system designed ...](https://github.com/openboxes/openboxes) - OpenBoxes is a warehouse management system designed to manage inventory and track stock movements fo...

32. [OpenBoxes](https://ithub.global.ssl.fastly.net/openboxes) - OpenBoxes has 8 repositories available. Follow their code on GitHub.

33. [Data Quality Score - Actian Data Observability](https://docs.actian.com/actian-data-observability/getting-started/monitoring-data/data-quality-score.html) - Documentation for Actian Data Observability — proactively understand, detect, and resolve data quali...

34. [Data Quality Metrics and KPIs: Measure What Matters](https://rowtidy.com/blog/data-quality-metrics-and-kpis) - Learn how to measure data quality with key metrics and KPIs. Track completeness, accuracy, consisten...

35. [18 Metrics With Examples | DQS Resources - Data Quality KPIs](https://dataqualitysense.com/resources/best-practices/data-quality-kpis/) - A catalog of 18 data quality KPIs with formulas, example targets, worked calculations, and a weighte...

36. [How to Measure Data Quality: KPIs & Scores | DQS Resources](https://dataqualitysense.com/resources/best-practices/measuring-data-quality/) - Define KPIs, build scorecards, and benchmark your data quality to drive continuous improvement.

