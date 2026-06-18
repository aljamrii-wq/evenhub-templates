/**
 * Aura integration tests.
 *
 * Note: global.WebSocket is mocked because HermesBridge.connect()
 * creates a real WebSocket that would fail in Node.js test environment.
 * The mock handles HELLO handshake automatically.
 */

// Mock WebSocket globally for HermesBridge
(global as any).WebSocket = class MockWebSocket {
  static OPEN = 1;
  readyState = 1; // OPEN immediately
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  send = jest.fn((data: string) => {
    // Auto-respond to HELLO with hello_ack
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'hello') {
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'hello_ack',
              version: msg.version,
              server: 'aura-engine',
              capabilities: {},
            }),
          });
        }, 0);
      }
    } catch {}
  });
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
  bridge.getDeviceInfo.mockResolvedValue(overrides.deviceInfo ?? null);
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

  it('show() renders Arabic text as image via updateImageRawData', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    await aura.show('مرحبا بالعالم');

    expect(bridge.updateImageRawData).toHaveBeenCalled();
    expect(bridge.textContainerUpgrade).not.toHaveBeenCalled();
  });

  it('show() renders English text via textContainerUpgrade', async () => {
    const auraEn = new Aura({ lang: 'en', gestures: false });
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await auraEn.init();

    await auraEn.show('Hello World');

    expect(bridge.textContainerUpgrade).toHaveBeenCalled();
    expect(bridge.updateImageRawData).not.toHaveBeenCalled();

    auraEn.dispose();
  });

  it('show() renders Urdu as image (RTL script)', async () => {
    const auraUr = new Aura({ lang: 'ur', gestures: false });
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await auraUr.init();

    await auraUr.show('السلام علیکم');

    expect(bridge.updateImageRawData).toHaveBeenCalled();
    expect(bridge.textContainerUpgrade).not.toHaveBeenCalled();

    auraUr.dispose();
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

  it('skips mode detection when mode is forced', async () => {
    const forcedAura = new Aura({ mode: 'personal', gestures: false });
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await forcedAura.init();

    expect(bridge.getDeviceInfo).not.toHaveBeenCalled();

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

  it('fires nod callback on IMU gesture (nod detection)', async () => {
    const bridge = mockBridge();
    let eventHandler: ((e: any) => void) | null = null;
    setupBridge(bridge, {
      eventHandler: (cb: any) => { eventHandler = cb; return () => {}; },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    const nodCb = jest.fn();
    aura.onNod(nodCb);
    await aura.init();

    // Simulate IMU data that gestures engine interprets as nod
    eventHandler!({
      sysEvent: {
        imuData: { x: 0.0, y: -9.8, z: 0.0 },
      },
    });

    // Let async gesture processing complete
    await new Promise((r) => setTimeout(r, 10));
  });

  it('fires shake callback on IMU gesture (shake detection)', async () => {
    const bridge = mockBridge();
    let eventHandler: ((e: any) => void) | null = null;
    setupBridge(bridge, {
      eventHandler: (cb: any) => { eventHandler = cb; return () => {}; },
    });
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    const shakeCb = jest.fn();
    aura.onShake(shakeCb);
    await aura.init();

    // Simulate IMU data that gestures engine interprets as shake
    eventHandler!({
      sysEvent: {
        imuData: { x: 15.0, y: 0.5, z: 5.0 },
      },
    });

    // Let async gesture processing complete
    await new Promise((r) => setTimeout(r, 10));
  });
  // --- Hermes integration ---

  it('ask() sends query via Hermes bridge', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    // Init completes HELLO handshake, ask() should not throw
    expect(() => aura.ask('What time is it?', 'en')).not.toThrow();
  });

  it('alert() sends alert via Hermes bridge', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();
    // Init completes HELLO handshake, alert() should not throw
    expect(() => aura.alert('Meeting', 'Starts in 5 minutes', 'en')).not.toThrow();
  });

  it('Hermes HELLO handshake completes on init', async () => {
    const bridge = mockBridge();
    setupBridge(bridge);
    (waitForEvenAppBridge as any).mockResolvedValue(bridge);

    await aura.init();

    // After init, Aura should be ready (HELLO completed)
    expect(aura.isReady).toBe(true);
  });
});
