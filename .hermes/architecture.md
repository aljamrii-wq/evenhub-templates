# Aura — Infrastructure Map

> Generated: 2026-06-16 | Repo: `github.com/aljamrigroup/aura` (private)
> Local: `/srv/hermes-agent/workspaces/aljamri/aura`
> Hardware: Even Realities G2 smart glasses (576×288, 4-bit green greyscale)

---

## 1. Repository Classification

| Dimension | Value |
|---|---|
| **Type** | Monorepo (SDK + engine + templates) |
| **Forked from** | `even-realities/evenhub-templates` (MIT) |
| **Languages** | TypeScript (SDK + templates), Python (engine backend) |
| **Frameworks** | Vite (frontend), FastAPI + uvicorn (backend), Even Hub SDK |
| **Platform** | Web app served to G2 glasses via companion phone app QR scan |
| **Node.js** | v18+ (templates), TypeScript 5.5+ (SDK) |
| **Python** | 3.11+, venv in `engine/.venv/` |

---

## 2. Directory Tree

```
aura/
├── aura-sdk/              # TypeScript SDK (the core product)
│   ├── src/
│   │   ├── index.ts       # Public API exports
│   │   ├── aura.ts        # Main Aura class — orchestrates all subsystems
│   │   ├── arabic.ts      # ArabicRenderer — delegates to engine HTTP API
│   │   ├── gestures.ts    # GestureEngine — IMU-based nod/shake/look detection
│   │   ├── hermes.ts      # HermesBridge — WebSocket client to engine
│   │   ├── modes.ts       # ModeDetector — time-based flydubai/aljamri/personal
│   │   └── types.ts       # Core types (Language, AuraMode, HermesMessage, etc.)
│   ├── package.json       # @aljamri/aura-sdk v0.1.0
│   └── tsconfig.json
├── engine/                # Python backend (FastAPI + WebSocket)
│   ├── renderer.py        # ✅ ArabicBitmapRenderer — PIL, arabic_reshaper, bidi
│   ├── test_renderer.py   # ✅ 20/20 tests passing
│   ├── test_bridge.py     # 📝 TDD tests written — hermes_bridge.py pending
│   ├── requirements.txt   # fastapi, uvicorn, websockets, Pillow, arabic-reshaper, python-bidi, httpx, pydantic
│   └── .venv/             # Python 3.12 venv with all deps installed
├── minimal/               # Template: bare Vite + Even Hub SDK scaffold
├── asr/                   # Template: microphone → speech-to-text pipeline
├── image/                 # Template: image container rendering
├── text-heavy/            # Template: paginated long-form text
└── .hermes/
    └── architecture.md    # This file
```

---

## 3. API Surface

### 3.1 SDK Public API (`aura-sdk/src/index.ts`)

| Export | Type | Purpose |
|---|---|---|
| `Aura` | Class | Main entry point — wraps bridge, arabic, gestures, hermes, modes |
| `ArabicRenderer` | Class | Renders Arabic text → engine → bitmap pixels |
| `GestureEngine` | Class | IMU oscillation → nod/shake/look gestures |
| `HermesBridge` | Class | WebSocket client → engine backend |
| `ModeDetector` | Class | Time-based auto-mode detection |

### 3.2 Engine API (Planned/In Progress)

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/health` | Liveness check | 📝 planned |
| `POST` | `/render` | Text → 4-bit bitmap (PIL + arabic_reshaper) | ✅ renderer.py done, endpoint pending |
| `WS` | `/ws/aura` | Bidirectional Hermes bridge | 📝 TDD written, impl pending |

### 3.3 WebSocket Message Protocol

**Client → Server (`HermesMessage`)**
```typescript
{
  type: 'query' | 'alert' | 'card' | 'translate',
  text: string,
  lang: 'ar' | 'en' | 'ur' | 'fa' | 'hi',
  mode?: 'flydubai' | 'aljamri' | 'personal',
  data?: Record<string, unknown>
}
```

**Server → Client (`AuraResponse`)**
```python
{
  type: 'text' | 'bitmap' | 'error',
  payload: str  # text response, base64 bitmap, or error message
}
```

---

## 4. Data Model

### 4.1 Core Types (`aura-sdk/src/types.ts`)

| Type | Values |
|---|---|
| `Language` | `'ar' \| 'en' \| 'ur' \| 'fa' \| 'hi'` |
| `AuraMode` | `'flydubai' \| 'aljamri' \| 'personal' \| 'auto'` |
| `GestureType` | `'nod' \| 'shake' \| 'look-left' \| 'look-right' \| 'look-down' \| 'unknown'` |

### 4.2 Mode Detection Rules

| Condition | Mode |
|---|---|
| Friday–Saturday (UAE weekend) | `personal` |
| Sunday–Thursday 9am–2pm | `flydubai` (sales shift) |
| Sunday–Thursday 2pm–6pm | `aljamri` (business admin) |
| Daily 6pm–10pm | `personal` (evening) |
| Daily 10pm–9am | `personal` (quiet/night) |

Rechecked every 5 minutes. Callbacks fire on mode change.

### 4.3 Session Store (Planned)

- SQLite via Python stdlib (`sqlite3`)
- Tables: `messages` (conversation history), `mode_history`, `preferences`
- No external DB dependency

---

## 5. Authentication & Security

| Layer | Status |
|---|---|
| **SDK → Engine WebSocket** | No auth yet — connects to `wss://hermes.aljamrigroup.com/aura` |
| **Engine → Hermes Agent** | Via subprocess (`hermes_command`), no API key flow yet |
| **Env vars** | None defined yet — will need `HERMES_API_KEY`, `AURA_SECRET` |
| **CORS** | Not configured — engine serves to companion app on phone |

**Security gaps to address:**
- WebSocket auth token (JWT or pre-shared key)
- Rate limiting on `/render` and `/ws/aura`
- Input sanitization on bitmap text (max length, encoding validation)

---

## 6. Build & Deploy

### 6.1 Build Commands

| Component | Command | Status |
|---|---|---|
| aura-sdk | `cd aura-sdk && npm run build` (tsc) | Configured |
| minimal template | `cd minimal && npm run build` (vite) | Configured |
| engine | `cd engine && source .venv/bin/activate && uvicorn main:app` | main.py pending |
| engine tests | `cd engine && source .venv/bin/activate && pytest -v` | ✅ 20/20 passing |

### 6.2 CI/CD

| Item | Status |
|---|---|
| GitHub Actions CI | ❌ None — no `.github/workflows/` |
| Docker | ❌ None |
| DO App Platform | ❌ No `.do/app.yaml` |
| Pre-commit hooks | ❌ None |
| Dependabot | ❌ None |

### 6.3 Production Deployment Target

- **Engine**: Systemd service on hermes-aljamri-01 (or DO droplet)
- **SDK**: Published to npm as `@aljamri/aura-sdk`
- **Templates**: Packed as `.ehpk` via `npx evenhub pack`, uploaded to Even Hub dev portal

---

## 7. External Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@evenrealities/even_hub_sdk` | ^1.0.0 (SDK), ^0.0.10 (templates) | Even G2 hardware bridge |
| `@evenrealities/evenhub-cli` | ^0.1.12 | QR code + pack commands |
| `@evenrealities/evenhub-simulator` | ^0.7.2 | Desktop simulator |
| `fastapi` | >=0.115.0 | Engine HTTP framework |
| `uvicorn` | >=0.30.0 | ASGI server |
| `websockets` | >=13.0 | Python WebSocket library |
| `Pillow` | >=10.0.0 | Image rendering |
| `arabic-reshaper` | >=3.0.0 | Arabic script shaping |
| `python-bidi` | >=0.6.0 | Bidirectional text reordering |
| `httpx` | >=0.27.0 | Async HTTP client |
| `pydantic` | >=2.0.0 | Data validation |

---

## 8. Multica Pipeline

| Resource | ID | Status |
|---|---|---|
| **Project** | `260d629c-bcb0-4386-94c0-c1ec76609d18` | planned |
| **Aura Hermes Agent** | `45e7f5a6-a7be-4853-a057-16c80ed93a13` | idle |
| **Aura DeepSeek Coding Worker** | `f45d30b7-ad11-417b-ae9a-062a26cde239` | 🟢 working |
| **Aura MiMo Coding Worker** | `3f7eec8e-d1c5-4577-940f-00510168154d` | 🟡 dispatched |

### Active Issues

| ID | Assignee | Status | Scope |
|---|---|---|---|
| ALJ-2174 | DeepSeek | in_progress | Python engine: WebSocket, bitmap, mode, session, main.py |
| ALJ-2175 | MiMo | in_progress | SDK tests, engine integration, demo template, docs |

### Autopilot

- **Aura Daily Coding Maintenance**: Every 2h at :00 and :30 (24/7)
- Active-work guard: no duplicate issues while agents are in_progress

---

## 9. Health Indicators

| Metric | Current | Target |
|---|---|---|
| Python tests | 20/20 ✅ | All passing |
| TypeScript tests | 0 (not configured) | Jest + ts-jest |
| CI configured | ❌ | GitHub Actions on push |
| Dependabot | ❌ | Enable for npm + pip |
| Engine deployed | ❌ | Systemd service |
| SDK published | ❌ | npm publish |
| Arabic rendering | ✅ Working (PIL pipeline) | Verified with real Arabic strings |

---

## 10. Gaps & Recommended Actions

| Priority | Action | Assignee |
|---|---|---|
| 🔴 P0 | Implement `engine/hermes_bridge.py` (TDD done) | DeepSeek (ALJ-2174) |
| 🔴 P0 | Implement `engine/main.py` (FastAPI server) | DeepSeek (ALJ-2174) |
| 🔴 P0 | Configure Jest + ts-jest in aura-sdk | MiMo (ALJ-2175) |
| 🟡 P1 | GitHub Actions CI for TypeScript build + Python tests | Future issue |
| 🟡 P1 | Dependabot for npm + pip | Future issue |
| 🟡 P1 | WebSocket auth (JWT or pre-shared key) | Future issue |
| 🟢 P2 | Dockerfile for engine | Future issue |
| 🟢 P2 | DO App Platform config | Future issue |
| 🟢 P2 | `.ehpk` packaging workflow | Future issue |
| 🟢 P2 | Pre-commit hooks (lint, format) | Future issue |
