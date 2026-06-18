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

- No App Store submissions from this repo.
- Sideload via developer certificate or TestFlight.
- See `AGENTS.md` in workspace root for full delivery rules.
