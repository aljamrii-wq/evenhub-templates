/**
 * GATT Service Readiness Guard
 *
 * The Even Hub SDK reports BLE 'connected' before GATT service discovery
 * completes on iOS (CBPeripheral state transitions to .connected before
 * discoverServices completes). Commands sent during this window silently
 * fail — resolve undefined or return null — because the GATT handles
 * they need aren't available yet.
 *
 * This module provides a readiness guard that polls a lightweight
 * GATT-dependent operation (getDeviceInfo) until it succeeds,
 * ensuring commands won't fail silently after init().
 *
 * @see ALJ-2328 — iOS BLE reports 'connected' before GATT services ready
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';

/** Default maximum time to wait for GATT service discovery (ms) */
const DEFAULT_GATT_TIMEOUT_MS = 5000;

/** Default interval between GATT readiness polls (ms) */
const DEFAULT_POLL_INTERVAL_MS = 200;

/**
 * Wait for GATT services to be ready after BLE connection.
 *
 * After the BLE connection is established, the OS needs time to
 * discover GATT services and characteristics. Until that completes,
 * commands like `createStartUpPageContainer` or `getDeviceInfo` can
 * silently fail (resolve undefined or return null) on iOS.
 *
 * This function polls `getDeviceInfo()` — a lightweight call that
 * requires GATT services — until it returns a valid response or
 * the timeout expires.
 *
 * @param bridge - The EvenAppBridge instance from waitForEvenAppBridge()
 * @param options.timeoutMs - Maximum time to wait (default: 5000ms)
 * @param options.pollIntervalMs - Interval between retries (default: 200ms)
 * @throws {Error} If GATT services are not ready within the timeout
 */
export async function waitForGattReady(
  bridge: EvenAppBridge,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_GATT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const info = await bridge.getDeviceInfo();
      if (info !== undefined && info !== null) {
        return;
      }
    } catch {
      // GATT not ready yet — retry after delay
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `GATT service discovery timeout after ${timeoutMs}ms. ` +
      `BLE is connected but GATT services are not ready. ` +
      `Check Bluetooth permissions and ensure glasses are in range.`,
  );
}

/**
 * Check if GATT services appear ready right now (non-blocking).
 */
export async function isGattReady(bridge: EvenAppBridge): Promise<boolean> {
  try {
    const info = await bridge.getDeviceInfo();
    return info !== undefined && info !== null;
  } catch {
    return false;
  }
}
