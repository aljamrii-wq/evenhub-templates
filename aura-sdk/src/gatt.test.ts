/**
 * Tests for GATT Service Readiness Guard
 * @see ALJ-2328 — iOS BLE reports 'connected' before GATT services ready
 */

import { waitForGattReady, isGattReady } from './gatt';

function mockBridge(impl: () => Promise<any>) {
  return { getDeviceInfo: impl } as any;
}

describe('isGattReady', () => {
  it('returns true when getDeviceInfo returns valid object', async () => {
    expect(await isGattReady(mockBridge(async () => ({ status: {} })))).toBe(true);
  });

  it('returns false on undefined', async () => {
    expect(await isGattReady(mockBridge(async () => undefined))).toBe(false);
  });

  it('returns false on null', async () => {
    expect(await isGattReady(mockBridge(async () => null))).toBe(false);
  });

  it('returns false on throw', async () => {
    expect(await isGattReady(mockBridge(async () => { throw new Error('nope'); }))).toBe(false);
  });
});

describe('waitForGattReady', () => {
  it('resolves immediately when GATT ready', async () => {
    const b = mockBridge(async () => ({ status: {} }));
    await waitForGattReady(b, { timeoutMs: 1000, pollIntervalMs: 50 });
  });

  it('retries and resolves on second attempt', async () => {
    let calls = 0;
    const b = mockBridge(async () => {
      calls++;
      return calls < 2 ? undefined : { status: {} };
    });
    await waitForGattReady(b, { timeoutMs: 1000, pollIntervalMs: 50 });
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('retries through errors and resolves', async () => {
    let calls = 0;
    const b = mockBridge(async () => {
      calls++;
      if (calls < 3) throw new Error('GATT error');
      return { status: {} };
    });
    await waitForGattReady(b, { timeoutMs: 2000, pollIntervalMs: 50 });
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('throws after timeout on persistent undefined', async () => {
    const b = mockBridge(async () => undefined);
    await expect(
      waitForGattReady(b, { timeoutMs: 200, pollIntervalMs: 50 }),
    ).rejects.toThrow(/GATT service discovery timeout/);
  });

  it('throws after timeout on persistent errors', async () => {
    const b = mockBridge(async () => { throw new Error('broken'); });
    await expect(
      waitForGattReady(b, { timeoutMs: 200, pollIntervalMs: 50 }),
    ).rejects.toThrow(/GATT service discovery timeout/);
  });

  it('includes timeout ms in error message', async () => {
    const b = mockBridge(async () => undefined);
    await expect(
      waitForGattReady(b, { timeoutMs: 3000, pollIntervalMs: 50 }),
    ).rejects.toThrow(/3000ms/);
  });

  it('resolves instantly (well under timeout) when ready', async () => {
    const b = mockBridge(async () => ({ status: {} }));
    const start = Date.now();
    await waitForGattReady(b, { timeoutMs: 5000, pollIntervalMs: 50 });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('handles null as not-ready', async () => {
    let calls = 0;
    const b = mockBridge(async () => { calls++; return calls < 2 ? null : { status: {} }; });
    await waitForGattReady(b, { timeoutMs: 1000, pollIntervalMs: 50 });
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
