# Aura App Agent Rules

## Scope
- This file applies to the Aura Glasses app (`aura-app/`).
- Forked from EvenDemoApp. BLE layer is kept; AI/render layer replaced with Aura Engine.

## Key Constraints
- **No App Store Connect** — sideload only. Never create App Store Connect versions or submit builds.
- **Custom SDK** (`@aljamri/aura-sdk`) is the TypeScript layer — this Flutter app is the native phone companion.
- **English + Arabic** support required for all user-facing text. Use Flutter localization.
- **BLE protocol** is sourced from `lib/services/proto.dart` and `ios/Runner/BluetoothManager.swift`. Don't change these without testing against G2 glasses.

## Build Pipeline
- Flutter iOS builds require macOS. Use Codemagic cloud CI or user's MacBook.
- Android builds can run on this Linux server (`flutter build apk --debug`).
- Run `flutter analyze` before any PR/commit.

## Verification
- `flutter pub get` must pass
- `flutter analyze` must have zero errors (warnings OK)
- Test BLE connection flow, AI prompt flow, and Arabic rendering
