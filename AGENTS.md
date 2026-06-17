# Aura — Smart Glasses AI Engine

Proactive intelligence layer for Even Realities G2 smart glasses.

## Structure

```
aura/                      <-- Root (this is the upstream evenhub-templates repo + Aura extensions)
├── engine/                <-- Python FastAPI server (Hermes WebSocket, Arabic bitmap renderer, mode detection)
├── aura-sdk/              <-- TypeScript SDK (@aljamri/aura-sdk) wrapping Even Hub SDK
├── minimal/               <-- G2 minimal starter template
├── asr/                   <-- G2 ASR (speech-to-text) template
├── image/                 <-- G2 image rendering template
├── text-heavy/            <-- G2 text pagination template
└── .github/workflows/     <-- CI (lint, typecheck, pytest, jest)
```

## Engine (engine/)

Python 3.12+, FastAPI + uvicorn, PIL + arabic_reshaper + python-bidi.

| File | Purpose |
|------|---------|
| `main.py` | FastAPI server: `/health`, `/render`, `/mode`, `/ws/aura` |
| `renderer.py` | 576x288 4-bit grayscale bitmap renderer with RTL Arabic support |
| `hermes_bridge.py` | WebSocket bridge: message types, session context, disconnect handling |
| `mode_detector.py` | Context-based mode classification (personal/airline/work) |
| `session_store.py` | Thread-safe persistent session store (JSON file-based) |

**Tests:** `python -m pytest engine/` — 103 tests passed (2026-06-17).

## Aura SDK (aura-sdk/)

TypeScript SDK (`@aljamri/aura-sdk`) extending Even Hub G2 SDK.

| File | Purpose |
|------|---------|
| `arabic.ts` | Arabic text detection and RTL handling |
| `engine.ts` | Hermes WebSocket client bridge |
| `gestures.ts` | IMU gesture detection (nod, shake, double-tap) |
| `modes.ts` | Mode auto-switch: Flydubai / Aljamri / Personal |
| `aura.ts` | Top-level AuraClient orchestration |
| `hermes.ts` | Hermes message protocol types |

**Tests:** `cd aura-sdk && npm test` — 81 tests passed. **Build:** `npm run build` (tsc).

## Templates

Each template is standalone Vite + TS:
- `npm run dev` — start dev server
- `npx evenhub-simulator http://localhost:5173` — test in simulator
- `npx evenhub pack` — produce .ehpk

## Arabic Requirements

- Engine: all responses must support Arabic text
- Bitmap renderer: RTL shaping via arabic_reshaper + python-bidi, diacritics, connected script
- SDK: must detect Arabic vs English and route to correct renderer
- G2 display: no native Arabic font — Arabic voice -> English text workaround

## Safety Boundaries

- No deploys, no merges to main, no secrets in code
- No provider/auth/payment/customer-data mutation
- No cross-repo edits beyond the Aura repo
- Use worktree isolation for all changes

## CI

GitHub Actions at `.github/workflows/`:
- Python: lint + pytest
- TypeScript: typecheck + jest
- SHA-pinned actions

## Git Conventions

- Branch from main: `feat/`, `fix/`, `infra/`
- Draft PRs for review
- No direct pushes to main
