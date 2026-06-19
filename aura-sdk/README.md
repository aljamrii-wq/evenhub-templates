# @aljamri/aura-sdk

Enhanced Even Hub SDK for G2 smart glasses — **Arabic/RTL rendering, IMU gestures, Hermes bridge, and mode detection.**

Built on top of [`@evenrealities/even_hub_sdk`](https://www.npmjs.com/package/@evenrealities/even_hub_sdk).

## Features

| Module | Description |
|---|---|
| **Aura** | Main class — wraps Even Hub SDK with Arabic, gestures, Hermes, mode detection |
| **ArabicRenderer** | Renders Arabic, Urdu, Farsi text as greyscale images via aura-engine |
| **EngineClient** | Typed HTTP client for aura-engine REST endpoints (`/health`, `/render`, `/mode`, `/translate`) |
| **GestureEngine** | Detects head gestures from IMU data: nod, shake, look-left, look-right, look-down |
| **HermesBridge** | WebSocket client for real-time aura-engine communication with auto-reconnect |
| **ModeDetector** | Auto-detects user mode (flydubai / aljamri / personal) from time + context |

## Install

```bash
npm install @aljamri/aura-sdk
```

Or from local path (during development):

```json
{
  "dependencies": {
    "@aljamri/aura-sdk": "file:../aura-sdk"
  }
}
```

## Quick Start

### English + Arabic Display

```ts
import { Aura } from '@aljamri/aura-sdk'

const aura = new Aura({ lang: 'ar', mode: 'auto' })
await aura.init()

// English — native G2 text rendering
await aura.show('Hello from Aura', 'en')

// Arabic — rendered as image via aura-engine
await aura.show('مرحبا من أورا', 'ar')
```

### Gesture Detection

```ts
aura.onNod(() => {
  console.log('User nodded')
})

aura.onShake(() => {
  console.log('User shook head')
})
```

### Mode Detection

```ts
aura.onModeChange((ctx) => {
  console.log(`Mode: ${ctx.mode} (${ctx.reason})`)
})
// Modes: 'flydubai' (work hours), 'aljamri' (afternoon business), 'personal' (evenings/weekends)
```

### Hermes Communication

```ts
// Send a query to aura-engine
await aura.ask('What time is my next flight?', 'ar')

// Receive responses
aura.onMessage((msg) => {
  if (msg.type === 'card') {
    aura.show(msg.text, msg.lang)
  }
})
```

## API Reference

### `Aura`

```ts
class Aura {
  constructor(config?: Partial<AuraConfig>)
  init(): Promise<void>
  show(text: string, lang?: Language): Promise<void>
  ask(question: string, lang?: Language): Promise<void>
  alert(title: string, body: string, lang?: Language): Promise<void>

  // Callbacks
  onNod(cb: () => void): void
  onShake(cb: () => void): void
  onModeChange(cb: (ctx: ModeContext) => void): void
  onMessage(cb: (msg: HermesMessage) => void): void

  // Properties
  readonly currentMode: AuraMode
  readonly isReady: boolean
  readonly bridgeInstance: EvenAppBridge | null
}
```

### `ArabicRenderer`

```ts
class ArabicRenderer {
  constructor(lang: Language, engineClient?: EngineClient)
  render(text: string, size?: number): Promise<Uint8Array>
  static needsImageRender(lang: Language): boolean
}
```

### `EngineClient`

```ts
class EngineClient {
  constructor(baseUrl: string)
  health(): Promise<EngineHealthResponse>
  render(req: EngineRenderRequest): Promise<EngineRenderResponse>
  detectMode(context: { hour: number; day: number; wearing?: boolean }): Promise<EngineModeResponse>
  translate(req: EngineTranslateRequest): Promise<EngineTranslateResponse>
}
```

### `GestureEngine`

```ts
class GestureEngine {
  process(x: number, y: number, z: number): GestureEvent
}
```

### `HermesBridge`

```ts
class HermesBridge {
  constructor(url: string)
  connect(): Promise<void>
  send(msg: HermesMessage): void
  onMessage(handler: (msg: HermesMessage) => void): void
  disconnect(): void
}
```

### `ModeDetector`

```ts
class ModeDetector {
  readonly current: AuraMode
  start(deviceInfo: DeviceInfo, now: Date): void
  stop(): void
  onChange(cb: (ctx: ModeContext) => void): void
  forceMode(mode: AuraMode): void
}
```

## Types

```ts
type Language = 'ar' | 'en' | 'ur' | 'fa' | 'hi'
type AuraMode = 'flydubai' | 'aljamri' | 'personal' | 'auto'
type GestureType = 'nod' | 'shake' | 'look-left' | 'look-right' | 'look-down' | 'unknown'

interface AuraConfig {
  lang: Language           // default: 'ar'
  mode: AuraMode           // default: 'auto'
  hermesUrl: string        // default: 'wss://hermes.aljamrigroup.com/aura'
  gestures: boolean        // default: true
  alwaysListen: boolean    // default: false
}

interface HermesMessage {
  type: 'query' | 'alert' | 'card' | 'translate'
  text: string
  lang: Language
  mode?: AuraMode
  data?: Record<string, unknown>
}

interface GestureEvent {
  type: GestureType
  confidence: number
  timestamp: number
}

interface ModeContext {
  mode: AuraMode
  confidence: number
  reason: string
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests (62 tests, 6 suites)
npm test

# Build TypeScript
npm run build

# Watch mode
npm run dev
```

## Integration with templates

See [`minimal/`](../minimal) for a working demo that uses the SDK:

```bash
cd minimal
npm install
npm run dev
# Shows English + Arabic on G2 display
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Aura SDK                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │Arabic    │  │Gesture   │  │Mode       │ │
│  │Renderer  │  │Engine    │  │Detector   │ │
│  └────┬─────┘  └──────────┘  └───────────┘ │
│       │                                     │
│  ┌────┴─────┐  ┌───────────┐               │
│  │Engine    │  │Hermes     │               │
│  │Client    │  │Bridge (WS)│               │
│  └────┬─────┘  └─────┬─────┘               │
└───────┼──────────────┼─────────────────────┘
        │ HTTP         │ WebSocket
        ▼              ▼
   ┌────────────────────────┐
   │   aura-engine (Python) │
   │   PIL + arabic_reshaper│
   │   + python-bidi        │
   └────────────────────────┘
```

## License

MIT — Aljamri Group
