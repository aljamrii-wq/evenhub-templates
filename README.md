# Aura — Smart Glasses App Framework

Aura wraps the [Even Realities G2](https://www.evenrealities.com/) SDK with Arabic/RTL rendering, head-gesture IMU detection, Hermes AI bridge, and mode auto-switching. Five starter templates ship out of the box.

## Templates

| Template | What it shows |
|---|---|
| [`minimal/`](./minimal) | Bare base: Vite + TypeScript + Aura SDK + simulator. "Hello from G2!" on the display. |
| [`asr/`](./asr) | Live mic → speech-to-text pipeline with companion UI and double-tap exit. STT provider is a blank stub — plug in your own. |
| [`image/`](./image) | Image container rendering. Preprocessing/dithering is optional; the SDK handles grayscale conversion. |
| [`text-heavy/`](./text-heavy) | Long-form text with tap-to-advance pagination. Pixel-accurate line measurement via @evenrealities/pretext. |
| [`hud/`](./hud) | Heads-up display showing time, battery, IMU gestures, mode, and Hermes connection status. |

## Quick start

```bash
git clone https://github.com/aljamrigroup/aura.git
cd aura
npm install
cd minimal && npm run dev
```

Then either:
- **Simulator:** `npm run simulate`
- **Real glasses:** `npx evenhub qr --url http://<your-ip>:5173` and scan with the Even Hub companion app.

## SDK (`aura-sdk/`)

TypeScript SDK wrapping the Even Hub G2 SDK with Arabic text rendering, IMU gesture detection, Hermes bridge client, and mode auto-switching.

```bash
cd aura-sdk
npm install
npm test                        # 122 tests pass
npm run build                   # typecheck + ESM fix
```

### API Surface

#### `Aura` (main class)

```typescript
import { Aura } from '@aljamri/aura-sdk'

const aura = new Aura({
  lang: 'ar',                             // 'ar' | 'en' | 'ur' | 'fa' | 'hi'
  mode: 'auto',                           // 'flydubai' | 'aljamri' | 'personal' | 'auto'
  hermesUrl: 'wss://hermes.aljamrigroup.com/ws/aura',
  token: 'optional-auth-token',
  gestures: true,
  alwaysListen: false,
})

await aura.init()                         // Connect to G2 bridge + Hermes WS
await aura.show('\u0645\u0631\u062d\u0628\u0627', 'ar')  // Arabic -> image render
await aura.ask('What is my next flight?')  // Send query to Hermes AI backend
await aura.alert('Reminder', 'Meeting at 3pm')

aura.onNod(() => console.log('nod detected'))
aura.onShake(() => console.log('shake detected'))
aura.onModeChange((ctx) => console.log('mode:', ctx.mode))
aura.onMessage((msg) => console.log('hermes response:', msg.payload))
aura.onExit(() => console.log('app exiting'))
aura.dispose()                             // Clean up all resources
```

#### `ArabicRenderer`

Renders Arabic/Urdu/Farsi text as grayscale images for the G2 display. Sends text to the aura-engine HTTP endpoint (`/render`) which uses PIL + arabic_reshaper + python-bidi.

#### `GestureEngine`

Detects head gestures (nod, shake, look-left, look-right, look-down) from IMU data. Processes raw `x/y/z` frames at 500ms intervals.

#### `HermesBridge`

WebSocket client for the aura-engine backend. Performs HELLO handshake on connect, auto-reconnects with exponential backoff (1s -> 30s max), and supports auth via subprotocol (`aura-token.xxx`).

#### `ModeDetector`

Auto-detects user mode from time of day + device status. Cycles between `flydubai` (work hours), `aljamri` (business), and `personal` (evenings/weekends). UAE-aware (Fri-Sat weekend).

#### `EngineClient`

HTTP client for aura-engine REST endpoints: `/health`, `/render`, `/mode`, `/translate`.

#### Container Constraints

Branded types and runtime validation for G2 display hardware:

```typescript
import {
  DISPLAY_WIDTH,       // 576
  DISPLAY_HEIGHT,      // 288
  DISPLAY_BIT_DEPTH,   // 4
  validateContainerRect,
  validateG2Pixels,
  assertG2Pixels,
  type G2Rect,
  type ContainerID,
} from '@aljamri/aura-sdk'
```

## Engine (`engine/`)

Python backend (FastAPI) that provides:

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check with component status |
| POST | `/render` | Render text to 4-bit grayscale bitmap (PNG) |
| POST | `/mode` | Detect user mode from context signals |
| WS | `/ws/aura` | WebSocket bridge for Aura SDK clients |

```bash
cd engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v                          # 167 tests pass
python main.py                     # http://127.0.0.1:8000
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| AURA_HOST | 127.0.0.1 | Bind address |
| AURA_PORT | 8000 | Listen port |
| AURA_LOG_LEVEL | info | Logging level |
| AURA_AUTH_TOKEN | (empty) | WebSocket auth token (enables remote connections) |
| AURA_MAX_WS_MESSAGE_BYTES | 65536 | Max WebSocket message size |
| AURA_DB_PATH | :memory: | SQLite database path |

## Pack for distribution

```bash
cd <template>
npm run build
npx evenhub pack app.json dist
```

Produces an `.ehpk` file you can upload through the [Even Hub dev portal](https://hub.evenrealities.com/).

All templates use `com.aljamri.aura.*` package IDs and support English + Arabic (`supported_languages: ["en", "ar"]`).

## Test on real glasses

```bash
npm run dev
npx evenhub qr --url http://<your-ip>:5173
```

Scan the QR code with the Even Hub companion app on a phone paired with your G2.

## Hardware quick reference

| Property | Value |
|---|---|
| Display | 576 x 288 px, 4-bit greyscale (16 shades of green) |
| Microphone | On the glasses, PCM s16le @ 16 kHz mono |
| Camera | None |
| Speaker | None |
| Input | Touchpad on the temple, optional R1 ring |

## Architecture

```
+-------------------------------------+
|  Aura SDK (TypeScript)              |
|  +----------+ +------------------+  |
|  | Gesture  | | Arabic Renderer  |  |
|  | Engine   | | (PNG via engine) |  |
|  +----------+ +------------------+  |
|  +----------+ +------------------+  |
|  | Hermes   | | Mode Detector    |  |
|  | Bridge   | | (time + device)  |  |
|  +----------+ +------------------+  |
|  +------------------------------+    |
|  | Even Hub SDK (Bridge Layer)  |    |
|  | legacy | custom transport    |    |
|  +------------------------------+    |
+--------------+----------------------+
               | BLE
+--------------v----------------------+
|  G2 Glasses (576x288, 4-bit)        |
+-------------------------------------+
               |
+--------------v----------------------+
|  aura-engine (Python/FastAPI)        |
|  /render  /mode  /health  /ws/aura  |
+-------------------------------------+
```

## Prerequisites

- Node.js v18+
- Python 3.10+ (for engine/backend)
- The Even Hub companion app installed on a phone, or the `evenhub-simulator` on desktop
- (ASR template only) An STT provider of your choice

## Resources

- [Even Hub Docs](https://hub.evenrealities.com/docs/getting-started/overview)
- [Even Hub SDK (npm)](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Simulator (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Community Discord](https://discord.gg/Y4jHMCU4sv)
- [SDK <-> Engine Integration](./docs/integration.md)

## License

MIT
