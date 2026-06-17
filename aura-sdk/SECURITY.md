# Aura SDK Security Architecture

## BLE Encryption Status

**Current state (Even Hub SDK v0.0.10):** All G2 Bluetooth LE communication — audio PCM streams, text/display commands, IMU sensor data, and device status — is transmitted in cleartext over standard Nordic UART Service (NUS) GATT characteristics with no link-layer encryption.

| Layer | Channel | Encryption | Sniffable |
|-------|---------|------------|-----------|
| Glasses ↔ Phone | BLE (NUS TX/RX) | ❌ None | Yes — any $20 BLE sniffer |
| Phone ↔ Hermes | WebSocket | ✅ TLS (WSS) | No |
| Phone → STT Provider | HTTPS | ✅ TLS | No |

### Attack Surface

An attacker within BLE range (~10m) of the G2 glasses can:

1. **Eavesdrop on microphone audio** — Capture raw 16kHz PCM s16le mono audio from glasses to phone. This is continuous when `audioControl(true)` is active, effectively turning the glasses into a live bug.

2. **Read display content** — All text and image data sent to the glasses display is visible. This includes personal messages, Hermes responses, alerts, and mode-switching context.

3. **Capture IMU data** — Head orientation data reveals user activity patterns (walking, standing, looking at specific areas).

4. **Inject display commands** — An attacker could write arbitrary text to the user's glasses display (spoofing).

5. **Track device identity** — BLE MAC address and device info broadcasts are linkable across sessions.

### Why This Is Not Yet Fixable at the SDK Level

The Aura SDK (`@aljamri/aura-sdk`) runs as JavaScript inside the Even Hub companion app's WebView. The BLE stack lives in Even Hub's Flutter/Dart native layer, which we do not control. The `EvenAppBridge` JavaScript API provides no method to request or enforce BLE pairing, bonding, or GATT characteristic security levels.

### Resolution Path

BLE encryption MUST be enforced at the companion app level. The security model requires:

1. **LE Secure Connections pairing** — The companion app must require authenticated pairing with the G2 glasses before any data exchange.

2. **Bonding** — Pairing keys must be persisted (bonded) so encryption is automatic on reconnect.

3. **GATT characteristic permissions** — Both TX (phone→glasses) and RX (glasses→phone) characteristics must require `ENCRYPTION` (GATT permission `0x02`) so the BLE stack refuses reads/writes without an encrypted link.

4. **Just Works → Passkey upgrade** — The default "Just Works" pairing (no MITM protection) should be upgraded to Passkey Entry or Numeric Comparison where the G2 hardware supports it.

### Custom Companion App (Aura Hub)

When Aura ships its own companion app (replacing Even Hub), the BLE security requirements are:

```
GATT Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E (Nordic UART Service)
  Characteristic: 6E400002-... (TX — phone → glasses)
    Properties: Write without response
    Permissions: ENCRYPTION required
  Characteristic: 6E400003-... (RX — glasses → phone)
    Properties: Notify
    Permissions: ENCRYPTION required
```

On Android, this maps to `BluetoothGattCharacteristic.PERMISSION_READ_ENCRYPTED | PERMISSION_WRITE_ENCRYPTED`. On iOS, CoreBluetooth enforces encryption automatically for characteristics configured as `CBAttributePermissions.ReadEncryptionRequired`.

### Application-Layer Defense-in-Depth

Even with BLE link-layer encryption, sensitive payloads should be encrypted at the application layer as defense-in-depth:

- **Audio:** No additional encryption needed at app layer — audio is processed locally for STT and transmitted to the STT provider over HTTPS. BLE encryption covers the glasses→phone hop.

- **Hermes messages:** Already encrypted via WSS. Display text is not confidential by design (it's shown on-screen).

- **Auth tokens / API keys:** Never transmit over BLE. Store on phone, use over HTTPS/WSS only.

### What Aura SDK Does Today

The `ble.ts` module in this SDK provides:

- **`BleSecurityConfig`** — Type definition for BLE security configuration that a companion app must implement
- **`BleSecurityLevel`** — Enum defining the required security levels (NONE → LESC_BONDED)
- **`validateBleSecurity()`** — Runtime assertion function that verifies the expected security level is active (requires companion app to expose security state via the bridge)

These are **documentation-as-code** — they define the security contract our companion app must fulfill but cannot enforce it from JavaScript alone.

### Verification

When a custom companion app is built, verify BLE encryption with:

```bash
# Android: Check bond state
adb shell dumpsys bluetooth_manager | grep -A5 "G2"

# BLE sniffer: Confirm encrypted packets (Wireshark shows "Encrypted" in packet info)

# Runtime assertion (once bridge supports security queries)
import { validateBleSecurity } from '@aljamri/aura-sdk';
await validateBleSecurity(bridge, BleSecurityLevel.LESC_BONDED);
```
