# Aura — Custom G2 Smart Glasses App

**Fork of EvenDemoApp → Aura by Aljamri**

## Architecture

```text
lib/
├── main.dart                    # Entry point → MaterialApp with Aura theme
├── app.dart                     # App-level lifecycle (exit all, cleanup)
├── ble_manager.dart             # BLE: scan, connect, send, receive, heartbeat
├── services/
│   ├── proto.dart               # BLE command encoding (heartbeat, AI, display)
│   ├── ble.dart                 # BleReceive / BleDevice type definitions
│   ├── evenai.dart              # AI flow controller (mic, speech, render)
│   ├── evenai_proto.dart        # Multi-pack BLE data formatting
│   ├── aura_engine_service.dart  # Aura Engine HTTP client (replaces DeepSeek)
│   ├── text_service.dart        # Text → glasses display pipeline
│   └── features_services.dart    # BMP image display
├── controllers/
│   └── evenai_model_controller.dart   # GetX state for AI history
├── models/
│   └── evenai_model.dart        # AI history data model
├── utils/
│   └── utils.dart               # Byte helpers, hex conversion
└── views/
    ├── home_page.dart          # BLE scan + AI home
    ├── even_list_page.dart     # AI history list
    ├── features_page.dart      # Feature selection
    └── features/
        ├── bmp_page.dart      # BMP image testing
        ├── text_page.dart     # Text-to-glasses
        └── notification/
            ├── notification_page.dart
            └── notify_model.dart
```

## BLE Protocol (G2 Glasses)

| Item | Value |
|------|-------|
| UART Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| Write Char | `6E400002` |
| Notify Char | `6E400003` |
| Peripheral pair | Left `_L_`, Right `_R_` |

See `services/proto.dart` for full command set.

## Aura Engine Backend

Aura Engine runs on the server at:
- Tailscale: `http://100.76.131.27:8000`
- External: `http://165.22.83.210:8000`

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `/chat` | POST | `{"query": "...", "mode": "chat"}` | `{"answer": "..."}` |

## Build

```bash
flutter pub get
flutter analyze
flutter build ios --no-codesign  # requires macOS
```

## Release Policy

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
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

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check with component status |
| POST | /render | Render text to 4-bit grayscale bitmap (base64) |
| POST | /mode | Detect user mode from context signals |
| WS | /ws/aura | WebSocket bridge for Aura SDK clients |

#### POST /render

Request:
```json
{ "text": "Arabic or English text", "font_size": 28 }
```

Response:
```json
{ "type": "bitmap", "payload": "<base64>" }
```

The payload is packed 4-bit grayscale bytes (576x288 pixels, 2 pixels per byte).

#### POST /mode

Request:
```json
{ "device_info": { "location": "office" }, "recent_interactions": ["flight booking"] }
```

Response:
```json
{ "mode": "flydubai", "confidence": 0.9, "reason": "Matched keywords in recent interactions" }
```

#### WebSocket /ws/aura

Auth (when `AURA_AUTH_TOKEN` is set, choose one):
- `Authorization: Bearer *** HTTP header (preferred)
- `X-Aura-Token: <token>` custom header
- `Sec-WebSocket-Protocol: aura-token.<token>` subprotocol (SDK default)

When `AURA_AUTH_TOKEN` is not set, only localhost connections are allowed.
Query-string tokens (`?token=`) are NOT supported — they leak through proxy logs.

Message format:
```json
{ "type": "query", "payload": "What is my next flight?", "mode": "flydubai" }
```

Response format:
```json
{ "type": "text", "payload": "Your next flight is FZ 123 at 14:30." }
```

## SDK (aura-sdk)

TypeScript SDK wrapping the Even Hub G2 SDK with Arabic text rendering, IMU gesture
detection, Hermes bridge client, and mode auto-switching.

```bash
cd aura-sdk
npm install
npm test                         # 53 tests pass
npm run build                    # typecheck + ESM fix
```

Substitute `minimal` with `asr`, `image`, or `text-heavy` for the other templates.

Or clone the whole repo and copy the folder you want:

```bash
git clone https://github.com/LesenmiaoYu/evenhub-templates.git
cp -r evenhub-templates/asr my-app
cd my-app && npm install
```

## Prerequisites

- Node.js v18+
- The Even Hub companion app installed on a phone, or the `evenhub-simulator` on desktop
- (ASR template only) An STT provider of your choice — Deepgram, AssemblyAI, Whisper, Soniox, self-hosted, etc.

## Test on real glasses

```bash
npm run dev
npx evenhub qr --url http://<your-ip>:5173
```

Scan the QR code with the Even Hub companion app on a phone paired with your G2.

## Test in the simulator

```bash
npm run dev
npx evenhub-simulator http://localhost:5173
```

## Pack for distribution

```bash
npx evenhub pack
```

Produces an `.ehpk` you can upload through the Even Hub dev portal.

## Hardware quick reference

| Property | Value |
|---|---|
| Display | 576 x 288 px, 4-bit greyscale (16 shades of green) |
| Microphone | On the glasses, PCM s16le @ 16 kHz mono |
| Camera | None |
| Speaker | None |
| Input | Touchpad on the temple, optional R1 ring |

## Resources

- [Even Hub Docs](https://hub.evenrealities.com/docs/getting-started/overview)
- [Even Hub SDK (npm)](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Simulator (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Community Discord](https://discord.gg/Y4jHMCU4sv)

## License

MIT
