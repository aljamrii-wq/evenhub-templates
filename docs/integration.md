# Aura SDK ↔ Engine Integration

How the TypeScript SDK (`aura-sdk/`) and the Python engine (`engine/`) fit
together to put Arabic text on the Even Realities G2 display.

## Pipeline

```
Arabic text
   │  (SDK: ArabicRenderer / EngineClient)
   ▼
POST /render  ───────────────►  engine (PIL + arabic_reshaper + python-bidi)
   │                                   │
   │                                   ▼
   │                             576×288 grayscale PNG
   ◄───────────────────────────────────┘
   │  (SDK receives PNG bytes)
   ▼
EvenAppBridge.updateImageRawData({ imageData: [...bytes] })
   ▼
G2 display (576×288, 4-bit / 16 shades of green)
```

For Latin/English text the SDK skips the engine entirely and uses the native
`textContainerUpgrade` path (see `Aura.show()` in `aura-sdk/src/aura.ts`).
Arabic, Urdu, and Farsi (`ArabicRenderer.needsImageRender`) go through the
engine because they need RTL shaping and connected glyphs the on-glasses text
renderer can't produce.

## Wire contracts

### `POST /render`

Request:

```json
{ "text": "مرحبا بكم في أورا", "font_size": 28 }
```

Response: **`Content-Type: image/png`** — a 576×288, mode-`L` (8-bit grayscale)
PNG. This is what the Even Hub SDK's `updateImageRawData` expects (encoded image
bytes, not raw pixels). The SDK reads it with `response.arrayBuffer()` and passes
the bytes straight through.

> Note: an earlier draft of the README described `/render` as returning
> base64-encoded 4-bit data. The implemented contract is a PNG. The raw 4-bit
> packed representation still exists in the engine (`ArabicBitmapRenderer.render`
> / `.raw_bytes`, `(576*288)/2 = 82944` bytes, 2 px/byte, high nibble first) and
> is used for direct display writes, but it is not what the HTTP endpoint serves.

### `WS /ws/aura`

Handshake (optional, version-negotiated):

```
client → { "type": "hello", "version": 1, "client": "aura-sdk", "capabilities": {} }
server → { "type": "hello_ack", "version": 1, "server": "aura-engine", "capabilities": {"render": true, "modes": true} }
```

On a version mismatch the server returns `hello_error` with
`supported_versions`. The handshake is backward-compatible: a client that never
sends HELLO can still send query/alert/mode_switch frames directly. The SDK's
`HermesBridge` sends HELLO on open, records the negotiated `version`, and flips
`isReady` to `true` on `hello_ack`.

Auth (when `AURA_AUTH_TOKEN` is set): `Authorization: Bearer ***,
`X-Aura-Token: <token>`, or the `aura-token.<token>` subprotocol (the SDK
default, since browser runtimes can't set custom headers). With no token
configured, only localhost connections are accepted.

`PROTOCOL_VERSION` is defined in both `aura-sdk/src/types.ts` and
`engine/hermes_bridge.py` and must be kept in sync.

## G2 IMU gesture handoff

The Flutter gesture layer is isolated in
`lib/services/imu_gesture_detector.dart` so BLE transport code can stay focused
on Nordic UART packet delivery. When the native BLE dispatcher identifies the G2
IMU notification opcode, pass the raw payload and side marker into
`ImuEventParser`, then feed valid samples into `ImuGestureDetector`:

```dart
final parser = ImuEventParser(expectedCommand: imuCommandByte);
final detector = ImuGestureDetector();

final sample = parser.tryParseBytes(receive.data, side: receive.lr);
if (sample != null) {
  final gesture = detector.addSample(sample);
  if (gesture != null) {
    // Publish nod/shake/look through the app gesture stream.
  }
}
```

The parser also accepts EventChannel maps shaped like
`{x, y, z, timestamp, lr, sequence}` for native IMU streams. Malformed packets
return `null` and should be ignored by BLE dispatch. The detector handles nod,
shake, and look gestures with a short debounce window to suppress duplicate
events and low-amplitude false positives.

## Verifying the pipeline

End-to-end, server side (decode the PNG, check geometry + Arabic ink):

```bash
cd engine && python -m pytest test_integration.py -q
```

Live, cross-process (SDK fetching the running engine over HTTP):

```bash
# terminal 1
cd engine && AURA_PORT=8077 python main.py

# terminal 2
cd aura-sdk && npm run build
node -e "import('./dist/arabic.js').then(async ({ArabicRenderer}) => {
  const r = new ArabicRenderer('ar', 'http://127.0.0.1:8077/render');
  const px = await r.render('مرحبا بكم في أورا', 28, 'ar');
  console.log('bytes', px.length, 'isPNG', px[0]===0x89 && px[1]===0x50);
})"
```

This was run during the production pass and returns a ~2 KB PNG with a valid
header, confirming Arabic text → engine → bitmap → SDK works over the real
transport.

## Gaps / follow-ups

- `EngineClient.detectMode({hour, day, wearing})` does not match the engine
  `/mode` contract (`device_info` + `recent_interactions`). Pydantic ignores the
  unknown fields, so the call returns a default-context mode rather than erroring.
  The render pipeline (the Arabic-critical path) is unaffected. Aligning the mode
  contract is tracked for a follow-up.
