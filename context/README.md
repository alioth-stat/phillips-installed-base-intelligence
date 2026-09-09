# Context — how this all fits together

This folder holds the raw material behind the Philips submission in this
repo, kept around so the same foundation can be reused for a **different**
hackathon challenge (the rules allow submitting more than one project — see
below). Three files:

| File | What it is | Use it for |
|---|---|---|
| [`hackathon-whatsapp-chat.md`](./hackathon-whatsapp-chat.md) | The official hackathon WhatsApp group, exported and phone-numbers-redacted (`Persona N` in place of real numbers; the organizer thread is `Persona 1`) | The primary source of truth for rules/dates/logistics as they were actually clarified in real time — organizers answered a lot of questions here that never made it into a formal doc. |
| [`qvac-sdk-research.md`](./qvac-sdk-research.md) | Pre-build research report on the QVAC SDK, model registry, and adjacent open-source tooling | Background reading before picking a stack for a new challenge — model options, on-device STT/dedup/storage library choices, prior-art links. |
| [`qvac-integration-notes.md`](./qvac-integration-notes.md) | **Written from this build, after actually running the SDK** — verified API shapes, gotchas, and bugs, not research-stage guesses | The most load-bearing file here if you're about to write code against QVAC. Read it before re-deriving anything the hard way. |

## The hackathon, summarized

**Decentralized AI Hackathon**, part of the **ISD Summit** (Panama).
Organized by ISD, technical sponsor **Tether** (the org behind QVAC).

- **Format:** fully remote. Starts Sept 9, 8:00 AM, runs **48 hours** —
  submission deadline Sept 11, 8:00 AM. In-person is optional: the awards +
  Summit events are Sept 11 (event from 10 AM, awards from 2 PM); every
  team that submits gets free general Summit entry for the whole team.
- **Eligibility:** must be 18+. No limit on number of participants or
  teams; one person can be on two different teams submitting two different
  solutions.
- **Submission:** via [trydojo.io](https://www.trydojo.io/hackathons/decentralized-ai-hackathon) —
  each project is **its own submission**: a public GitHub repo + a video,
  per project. You can submit **multiple projects** — one to the open
  "general" track (any problem you identify) plus one per corporate
  challenge you choose to also tackle. Corporate-challenge prizes are
  **stackable** with a general-track placement (e.g. you can win 2nd place
  overall *and* a sponsor's challenge prize with the same or a different
  submission).
- **Corporate challenges are optional**, not required to participate. A
  solution submitted against a corporate challenge must still meet the same
  hard technical requirement as everything else (see below).
- **IP:** stays with the team. If a sponsor wants to use something from a
  submission, they negotiate with that team directly — no blanket rights
  transfer.
- **The one hard technical requirement, for every submission regardless of
  track:** inference must run **on-device or peer-to-peer via QVAC** — no
  cloud LLM/API calls for the actual inference. This is verified before a
  submission is passed to a sponsor, and disqualifies an otherwise-good
  solution regardless of output quality.
- **Known corporate challenges mentioned in the chat:** Philips
  ("Customer Installed Base Intelligence" — what this repo solves,
  released first), and others hinted at in the general themes ISD
  described before release: document management, manuals/operational
  guides, maintenance reports, network incident analysis. Ovnicom was also
  named as a challenge sponsor. Check the WhatsApp log and/or
  trydojo.io directly for what's live now — challenges were released on a
  rolling basis during the event, not all at once.

## Using this repo as a starting point for another challenge

If you're tackling a **second** challenge (own submission, own repo per the
rules above), the fastest path is: don't start from zero.

1. Read `qvac-integration-notes.md` first — it'll save you re-discovering
   the transcription/multimodal/event-loop gotchas from scratch.
2. Copy `qvac_client.py` as-is into the new repo; it's already generic.
   Swap in whichever model constants the new problem needs.
3. Copy the FastAPI wrapper *pattern* from `api.py` (thin, plain `def`
   routes, zero business logic of its own) — rewrite the routes for the
   new domain.
4. Copy `frontend/src/components/Background.tsx`, `GlassPanel.tsx`, and
   `StepShell.tsx` as-is — they're a fully generic sliding-wizard shell.
   Swap in new step components for whatever flow the new challenge needs.
5. Everything else in the repo root (`extract.py`, `db.py`, `dedupe.py`,
   `confidence.py`) is Philips-domain-specific — useful as a *reference*
   for the shape of a solution (schema-constrained extraction, fuzzy
   dedup, a confidence score), not as drop-in code, unless the new
   challenge is also "extract structured data and detect duplicates."

See the root [`README.md`](../README.md) for how to actually run this
repo's app.
