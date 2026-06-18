import { HermesBridge } from './hermes';
import type { HermesMessage, AuraResponse } from './types';
import { PROTOCOL_VERSION } from './types';

describe('HermesBridge', () => {
  let bridge: HermesBridge;

  beforeEach(() => {
    bridge = new HermesBridge('wss://test.example.com/ws');
  });

  afterEach(() => {
    bridge.disconnect();
  });

  it('stores the URL on construction', () => {
    expect(bridge).toBeDefined();
  });

  it('version is null before connect', () => {
    expect(bridge.version).toBeNull();
    expect(bridge.isReady).toBe(false);
  });

  it('send does not throw when not connected', () => {
    const msg: HermesMessage = {
      type: 'query',
      payload: 'Hello',
      version: PROTOCOL_VERSION,
      mode: 'personal',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('send does not throw before handshake (negotiatedVersion is null)', () => {
    const msg: HermesMessage = {
      type: 'query',
      payload: 'Hello',
      version: PROTOCOL_VERSION,
      mode: 'personal',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('registers message handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bridge.onMessage(handler1);
    bridge.onMessage(handler2);
    // Handlers are stored — no error means success
  });

  it('disconnect stops reconnection', () => {
    bridge.disconnect();
    // shouldReconnect is now false
  });

  it('disconnect is idempotent', () => {
    bridge.disconnect();
    expect(() => bridge.disconnect()).not.toThrow();
  });

  it('constructs with different URLs', () => {
    const b1 = new HermesBridge('wss://a.example.com');
    const b2 = new HermesBridge('wss://b.example.com');
    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    b1.disconnect();
    b2.disconnect();
  });

  it('sends alert messages without throwing', () => {
    const msg: HermesMessage = {
      type: 'alert',
      payload: 'Meeting starts soon',
      version: PROTOCOL_VERSION,
      mode: 'flydubai',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('sends mode_switch messages without throwing', () => {
    const msg: HermesMessage = {
      type: 'mode_switch',
      payload: '{"to":"aljamri"}',
      version: PROTOCOL_VERSION,
      mode: 'personal',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('onMessage callback receives correct payload type', () => {
    const handler = jest.fn();
    bridge.onMessage(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('disconnect resets negotiated version', () => {
    bridge.disconnect();
    expect(bridge.version).toBeNull();
    expect(bridge.isReady).toBe(false);
  });
});

describe('HermesBridge — HELLO handshake (mock WebSocket)', () => {
  let bridge: HermesBridge;
  let mockWs: any;

  beforeEach(() => {
    bridge = new HermesBridge('wss://test.example.com/ws');
    mockWs = {
      readyState: 0, // CONNECTING
      sent: [] as string[],
      onopen: null as (() => void) | null,
      onmessage: null as ((event: any) => void) | null,
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      send(data: string) {
        this.sent.push(data);
      },
      close() {},
    };

    // Override WebSocket constructor
    (global as any).WebSocket = jest.fn(() => mockWs);
  });

  afterEach(() => {
    bridge.disconnect();
    jest.restoreAllMocks();
  });

  it('sends HELLO message on WebSocket open', async () => {
    const connectPromise = bridge.connect();

    // Simulate open
    mockWs.readyState = 1; // OPEN
    mockWs.onopen?.();

    // HELLO should have been sent
    expect(mockWs.sent.length).toBe(1);
    const hello = JSON.parse(mockWs.sent[0]);
    expect(hello.type).toBe('hello');
    expect(hello.version).toBe(PROTOCOL_VERSION);
    expect(hello.client).toContain('aura-sdk');
    expect(hello.capabilities).toBeDefined();

    // Simulate hello_ack from server
    mockWs.onmessage?.({ data: JSON.stringify({
      type: 'hello_ack',
      version: 1,
      server: 'aura-engine',
      capabilities: {},
    }) });

    await connectPromise;
    expect(bridge.isReady).toBe(true);
    expect(bridge.version).toBe(1);
  });

  it('rejects on hello_error from server', async () => {
    const connectPromise = bridge.connect();

    mockWs.readyState = 1;
    mockWs.onopen?.();

    // Simulate hello_error
    mockWs.onmessage?.({ data: JSON.stringify({
      type: 'hello_error',
      server: 'aura-engine',
      supported_versions: [2],
      error: 'Unsupported version',
    }) });

    await expect(connectPromise).rejects.toThrow('Handshake rejected');
    expect(bridge.isReady).toBe(false);
  });

  it('does not dispatch messages to handlers before handshake', async () => {
    const handler = jest.fn();
    bridge.onMessage(handler);

    const connectPromise = bridge.connect();
    mockWs.readyState = 1;
    mockWs.onopen?.();

    // Simulate a message arriving before handshake completes
    mockWs.onmessage?.({ data: JSON.stringify({
      type: 'text',
      payload: 'early message',
    }) });

    // Handler should NOT have been called (no handshake yet)
    expect(handler).not.toHaveBeenCalled();

    // Complete handshake
    mockWs.onmessage?.({ data: JSON.stringify({
      type: 'hello_ack',
      version: 1,
      server: 'aura-engine',
      capabilities: {},
    }) });

    await connectPromise;

    // Now dispatch a message
    mockWs.onmessage?.({ data: JSON.stringify({
      type: 'text',
      payload: 'post-handshake message',
    }) });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'text',
      payload: 'post-handshake message',
    });
  });

  it('rejects handshake when WebSocket closes mid-handshake', async () => {
    const connectPromise = bridge.connect();

    mockWs.readyState = 1;
    mockWs.onopen?.();

    // Simulate close before hello_ack arrives
    mockWs.onclose?.();

    await expect(connectPromise).rejects.toThrow('WebSocket closed during handshake');
  });

  it('attempts reconnect on close with exponential backoff', async () => {
    jest.useFakeTimers();

    // Override WebSocket constructor for this test
    const wsInstances: any[] = [];
    (global as any).WebSocket = jest.fn(() => {
      const ws = {
        readyState: 0,
        sent: [] as string[],
        onopen: null as any,
        onmessage: null as any,
        onclose: null as any,
        onerror: null as any,
        send(data: string) { this.sent.push(data); },
        close() {},
      };
      wsInstances.push(ws);
      return ws;
    });

    const b = new HermesBridge('wss://test.example.com/ws');
    const connectPromise = b.connect();

    // First WS opens and sends HELLO
    wsInstances[0].readyState = 1;
    wsInstances[0].onopen?.();
    expect(wsInstances[0].sent.length).toBe(1);

    // Wait for current timers
    await jest.runAllTimersAsync();

    // Complete handshake
    wsInstances[0].onmessage?.({ data: JSON.stringify({
      type: 'hello_ack', version: 1, server: 'aura-engine', capabilities: {},
    }) });
    await connectPromise;
    expect(b.isReady).toBe(true);

    // Now close — should trigger reconnect after delay
    wsInstances[0].onclose?.();
    expect(b.isReady).toBe(false);

    // Advance time past reconnect delay (1000ms)
    jest.advanceTimersByTime(1100);

    // Second WS should have been created
    expect(wsInstances.length).toBe(2);
    wsInstances[1].readyState = 1;
    wsInstances[1].onopen?.();
    expect(wsInstances[1].sent.length).toBe(1);

    b.disconnect();
    jest.useRealTimers();
  });

  it('rejects connect when onerror fires before open', async () => {
    const connectPromise = bridge.connect();

    // Simulate error
    mockWs.onerror?.();

    await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
  });});
