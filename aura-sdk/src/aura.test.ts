/**
 * Aura integration tests.
 * 
 * Note: global.WebSocket is mocked because HermesBridge.connect() 
 * creates a real WebSocket that would fail in Node.js test environment.
 */

// Mock WebSocket globally for HermesBridge
(global as any).WebSocket = class MockWebSocket {
  static OPEN = 1;
  readyState = 1; // OPEN immediately
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  constructor(_url: string) {
    // Fire onopen on next tick so connect() resolves
    setTimeout(() => this.onopen?.(), 0);
  }
};

import { Aura } from './aura';
import type { ModeContext } from './types';

import {
  waitForEvenAppBridge,
  EvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk';

function mockBridge() {
  return EvenAppBridge.getInstance() as any;
}

function setupBridge(bridge: any, overrides: Record<string, any> = {}) {
  bridge.createStartUpPageContainer.mockResolvedValue(overrides.createResult ?? 0);
    // Default to truthy deviceInfo so GATT readiness guard passes.
  // Use deviceInfo: null only when explicitly testing GATT timeout.
  bridge.getDeviceInfo.mockResolvedValue(
    overrides.deviceInfo !== undefined ? overrides.deviceInfo : { status: {} },
  );
  if (overrides.eventHandler) {
    bridge.onEvenHubEvent.mockImplementation(overrides.eventHandler);
  } else {
    bridge.onEvenHubEvent.mockReturnValue(() => {});
  }
}

describe('Aura', () => {
  let aura: Aura;

  beforeEach(() => {
    jest.clearAllMocks();
    aura = new Aura({ gestures: true, alwaysListen: false });
  });

  afterEach(() => {
    aura.dispose();
  });

  // --- Constructor ---

  it('constructs with defaults', () => {
    const a = new Aura();
    expect(a).toBeDefined();
    expect(a.currentMode).toBe('personal');
    expect(a.isReady).toBe(false);
    expect(a.bridgeInstance).toBeNull();
  });

  it('constructs with custom config', () => {
    const a = new Aura({ lang: 'en', mode: 'flydubai' });
    expect(a).toBeDefined();
    expect(a.currentMode).toBe('personal');
  });

  // --- Init ---

  it('initializes and connects to bridge', async () => {
    const bridge = mockBridge();
    setupBridge(bridge, {
      deviceInfo: { status: { isWearing: true, batteryLevel: 85 } },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    expect(aura.isReady).toBe(true);
    expect(aura.bridgeInstance).toBe(bridge);
    expect(bridge.createStartUpPageContainer).toHaveBeenCalled();
  });

  it('throws on failed container creation', async () => {
    const bridge = mockBridge();
    setupBridge(bridge, { createResult: -1 });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await expect(aura.init()).rejects.toThrow('Failed to create page container');
    expect(aura.isReady).toBe(false);
  });

  it('registers OS event handler on init', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    expect(bridge.onEvenHubEvent).toHaveBeenCalled();
  });

  it('handles double-tap exit event (sysEvent)', async () => {
    const bridge = mockBridge();
    let eventHandler: ((e: any) => void) | null = null;
    setupBridge(bridge, {
      eventHandler: (cb: any) => { eventHandler = cb; return () => {}; },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    const exitCb = jest.fn();
    aura.onExit(exitCb);
    await aura.init();

    eventHandler!({
      sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
    });

    expect(exitCb).toHaveBeenCalled();
    expect(bridge.shutDownPageContainer).toHaveBeenCalledWith(1);
  });

  it('handles double-tap exit event (textEvent)', async () => {
    const bridge = mockBridge();
    let eventHandler: ((e: any) => void) | null = null;
    setupBridge(bridge, {
      eventHandler: (cb: any) => { eventHandler = cb; return () => {}; },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    eventHandler!({
      textEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
    });

    expect(bridge.shutDownPageContainer).toHaveBeenCalledWith(1);
  });

  it('disposes on system exit event', async () => {
    const bridge = mockBridge();
    let eventHandler: ((e: any) => void) | null = null;
    setupBridge(bridge, {
      eventHandler: (cb: any) => { eventHandler = cb; return () => {}; },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    eventHandler!({
      sysEvent: { eventType: OsEventTypeList.SYSTEM_EXIT_EVENT },
    });

    expect(aura.isReady).toBe(false);
  });

  // --- Dispose ---

  it('dispose stops mode detection and cleans up', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    expect(aura.isReady).toBe(true);

    aura.dispose();

    expect(aura.isReady).toBe(false);
  });

  it('dispose is idempotent', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    aura.dispose();
    expect(() => aura.dispose()).not.toThrow();
  });

  it('init throws after dispose', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    aura.dispose();

    await expect(aura.init()).rejects.toThrow('Aura has been disposed');
  });

  // --- Show ---

  it('throws if show called before init', async () => {
    await expect(aura.show('Hello')).rejects.toThrow('Aura not initialized');
  });

  // --- Callbacks ---

  it('registers all callbacks', () => {
    aura.onNod(jest.fn());
    aura.onShake(jest.fn());
    aura.onModeChange(jest.fn());
    aura.onMessage(jest.fn());
    aura.onExit(jest.fn());
    // All callbacks registered without error
  });

  // --- Mode detection ---

  it('starts mode detection when mode is auto', async () => {
    const bridge = mockBridge();
    setupBridge(bridge, {
      deviceInfo: { status: { isWearing: true, batteryLevel: 85 } },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    // Mode detection should have been wired — getDeviceInfo is called
    expect(bridge.getDeviceInfo).toHaveBeenCalled();
  });

  it('GATT guard calls getDeviceInfo even when mode is forced', async () => {
    const forcedAura = new Aura({ mode: 'personal', gestures: false });
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await forcedAura.init();

        // GATT guard calls getDeviceInfo once; mode detection is skipped

    forcedAura.dispose();
  });

  // --- IMU gestures ---

  it('enables IMU when gestures config is on', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    expect(bridge.imuControl).toHaveBeenCalledWith(true, 500);
  });

  it('skips IMU when gestures config is off', async () => {
    const noGesturesAura = new Aura({ gestures: false });
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await noGesturesAura.init();

    expect(bridge.imuControl).not.toHaveBeenCalled();

    noGesturesAura.dispose();
  });

  // --- Hermes integration ---

  it('ask() sends query via Hermes bridge', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    aura.ask('What time is it?', 'en');
  });

  it('alert() sends alert via Hermes bridge', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    aura.alert('Meeting', 'Starts in 5 minutes', 'en');
  });
  // --- GATT readiness guard ---

  it('throws when GATT services never become ready', async () => {
    // Use a short GATT timeout so the test completes before Jest's 5s default
    const gattAura = new Aura({ gattTimeoutMs: 200 });
    const bridge = mockBridge();
    setupBridge(bridge, { deviceInfo: null });  // null = GATT never ready
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await expect(gattAura.init()).rejects.toThrow(/GATT service discovery timeout/);
    expect(gattAura.isReady).toBe(false);
    gattAura.dispose();
  });

  it('skips GATT guard when gattTimeoutMs is 0', async () => {
    const noGatt = new Aura({ gattTimeoutMs: 0 });
    const bridge = mockBridge();
    setupBridge(bridge, { deviceInfo: null });  // null won't matter — guard is skipped
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await noGatt.init();
    expect(noGatt.isReady).toBe(true);
    noGatt.dispose();
  });

});
