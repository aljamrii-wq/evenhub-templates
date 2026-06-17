/**
 * BLE Security Module
 *
 * Documentation-as-code for the Bluetooth LE security contract that
 * the Aura companion app must enforce. The Even Hub SDK (v0.0.10)
 * transmits all data over BLE in cleartext — no link-layer encryption.
 *
 * This module defines the types, constants, and runtime assertions
 * that encode the required security posture. These are NOT currently
 * enforceable from JavaScript (the BLE stack lives in the native
 * companion app), but they serve as the canonical specification for
 * the security model.
 *
 * When Aura ships its own companion app (Aura Hub), the BLE security
 * state must be exposed through the bridge so validateBleSecurity()
 * can assert the expected level at runtime.
 *
 * @see SECURITY.md for the full security architecture
 */

/**
 * BLE security levels for the glasses-to-phone link.
 *
 * Maps to Android BluetoothDevice bond states and iOS CBPeripheral
 * encryption state.
 */
export enum BleSecurityLevel {
  /** No pairing, no encryption. All data visible to BLE sniffers. */
  NONE = 0,
  /** LE Legacy pairing with "Just Works" (no MITM protection). */
  JUST_WORKS = 1,
  /** LE Secure Connections, bonded, encryption active. Required minimum. */
  LESC_BONDED = 2,
  /** LE Secure Connections + Passkey Entry / Numeric Comparison (MITM-protected). */
  LESC_AUTHENTICATED = 3,
}

/**
 * Configuration contract that the companion app must implement.
 *
 * The native companion app is responsible for:
 * - Initiating LE Secure Connections pairing with bonding
 * - Setting GATT characteristic permissions to require ENCRYPTION
 * - Exposing the current security level through the bridge API
 */
export interface BleSecurityConfig {
  /** Required minimum security level */
  requiredLevel: BleSecurityLevel;
  /** Enforce bonding (persist keys across reconnects) */
  requireBonding: boolean;
  /** Require MITM protection (Passkey/Numeric Comparison) */
  requireMitm: boolean;
}

/**
 * Runtime security state reported by the companion app bridge.
 *
 * When the companion app exposes BLE security state, the bridge
 * should surface this structure through a getBleSecurity() method
 * or similar API.
 */
export interface BleSecurityState {
  /** Current active security level */
  level: BleSecurityLevel;
  /** Whether the device is bonded (keys persisted) */
  bonded: boolean;
  /** Whether MITM protection is active */
  mitmProtected: boolean;
  /** LE Secure Connections negotiated (vs legacy pairing) */
  leSecureConnections: boolean;
  /** Encryption key size in bytes (0 if no encryption) */
  keySize: number;
}

/**
 * Default BLE security configuration — the minimum acceptable posture.
 *
 * Requires LE Secure Connections with bonding. MITM protection
 * (Passkey/Numeric Comparison) is recommended but may be limited
 * by G2 firmware capabilities.
 */
export const DEFAULT_BLE_SECURITY: BleSecurityConfig = {
  requiredLevel: BleSecurityLevel.LESC_BONDED,
  requireBonding: true,
  requireMitm: false,
};

/**
 * Strict BLE security configuration — requires MITM protection.
 *
 * Use this for high-security contexts where an attacker could
 * physically position themselves between the glasses and phone.
 */
export const STRICT_BLE_SECURITY: BleSecurityConfig = {
  requiredLevel: BleSecurityLevel.LESC_AUTHENTICATED,
  requireBonding: true,
  requireMitm: true,
};

/**
 * GATT service and characteristic UUIDs for the Nordic UART Service
 * used by Even Realities G2 glasses. These are the channels that
 * MUST require ENCRYPTION permission.
 *
 * @see https://developer.nordicsemi.com/ for NUS specification
 */
export const BLE_GATT_UUIDS = {
  /** Nordic UART Service */
  SERVICE: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  /** TX characteristic (phone -> glasses): Write Without Response */
  TX: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
  /** RX characteristic (glasses -> phone): Notify */
  RX: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
} as const;

/**
 * Data types transmitted over BLE and their sensitivity classification.
 *
 * Used for documentation and potential application-layer encryption
 * decisions.
 */
export enum BleDataType {
  /** Display text/commands (show on glasses) */
  DISPLAY = 'display',
  /** Microphone audio PCM stream */
  AUDIO = 'audio',
  /** IMU/gyroscope sensor data */
  IMU = 'imu',
  /** Device status (battery, wearing state) */
  STATUS = 'status',
  /** Touch/tap events */
  TOUCH = 'touch',
  /** System lifecycle events */
  SYSTEM = 'system',
}

/**
 * Sensitivity classification for each BLE data type.
 */
export const BLE_DATA_SENSITIVITY: Record<BleDataType, 'low' | 'medium' | 'high'> = {
  [BleDataType.DISPLAY]: 'medium',
  [BleDataType.AUDIO]: 'high',
  [BleDataType.IMU]: 'medium',
  [BleDataType.STATUS]: 'low',
  [BleDataType.TOUCH]: 'low',
  [BleDataType.SYSTEM]: 'low',
};

/**
 * Validate that the BLE security state meets the required configuration.
 *
 * This is a runtime assertion that should be called during SDK
 * initialization. Currently, it always passes because the Even Hub
 * bridge does not expose BLE security state. When the bridge exposes
 * a getBleSecurity() method, this function will assert the actual
 * security level against the configuration.
 *
 * @param securityState - Current BLE security state from companion app bridge
 * @param config - Required security configuration (defaults to DEFAULT_BLE_SECURITY)
 * @throws {Error} If the security state does not meet requirements
 */
export function validateBleSecurity(
  securityState: BleSecurityState | null,
  config: BleSecurityConfig = DEFAULT_BLE_SECURITY,
): void {
  // Until the companion app exposes BLE security state through the bridge,
  // we cannot enforce this assertion. When available, uncomment the checks.
  if (securityState === null) {
    // Bridge does not expose BLE security state yet.
    // This is expected with the current Even Hub SDK.
    return;
  }

  if (securityState.level < config.requiredLevel) {
    throw new Error(
      `BLE security level insufficient: required ${BleSecurityLevel[config.requiredLevel]}, ` +
      `got ${BleSecurityLevel[securityState.level]}. Data is transmitted in cleartext.`,
    );
  }

  if (config.requireBonding && !securityState.bonded) {
    throw new Error(
      'BLE bonding required but device is not bonded. ' +
      'Pairing keys must be persisted to maintain encryption across reconnects.',
    );
  }

  if (config.requireMitm && !securityState.mitmProtected) {
    throw new Error(
      'BLE MITM protection required but not active. ' +
      'Upgrade pairing method to Passkey Entry or Numeric Comparison.',
    );
  }
}

/**
 * Create a security report string for logging/diagnostics.
 */
export function formatBleSecurityReport(state: BleSecurityState): string {
  const lines = [
    `BLE Security State:`,
    `  Level: ${BleSecurityLevel[state.level]} (${state.level})`,
    `  Bonded: ${state.bonded}`,
    `  MITM Protected: ${state.mitmProtected}`,
    `  LE Secure Connections: ${state.leSecureConnections}`,
    `  Key Size: ${state.keySize} bytes`,
  ];

  if (state.level === BleSecurityLevel.NONE) {
    lines.push('  WARNING: No BLE encryption — all data in cleartext');
  }

  return lines.join('\n');
}
