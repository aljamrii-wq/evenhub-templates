import { HermesBridge } from './hermes';
import type { HermesMessage, HermesResponse } from './types';

class MockWebSocket {
  url: string;
  protocols: string[] | undefined;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string, protocols?: string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; this.onclose?.(); }
}

describe('HermesBridge', () => {
  let bridge: HermesBridge;
  let mockWs: MockWebSocket;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket('wss://test.example.com/ws/aura');
    (global as any).WebSocket = jest.fn((url: string, protocols?: string[]) => {
      mockWs.url = url;
      mockWs.protocols = protocols;
      return mockWs;
    });
    (global as any).WebSocket.CONNECTING = 0;
    (global as any).WebSocket.OPEN = 1;
    (global as any).WebSocket.CLOSING = 2;
    (global as any).WebSocket.CLOSED = 3;
    bridge = new HermesBridge('wss://test.example.com/ws/aura');
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    bridge.disconnect();
  });

  describe('constructor', () => {
    it('stores the URL', () => {
      const b = new HermesBridge('wss://custom.url/ws/aura');
      expect(b).toBeDefined();
    });

    it('accepts optional token for subprotocol auth', () => {
      const b = new HermesBridge('wss://custom.url/ws/aura', 'secret123');
      expect(b).toBeDefined();
    });
  });

  describe('connect', () => {
    it('creates a WebSocket and resolves on open', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('passes token as subprotocol when provided', async () => {
      const b = new HermesBridge('wss://auth.url/ws/aura', 'secret123');
      const connectPromise = b.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;
      expect(mockWs.protocols).toEqual(['aura-token.secret123']);
    });

    it('rejects on WebSocket error', async () => {
      const connectPromise = bridge.connect();
      mockWs.onerror?.();
      await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
    });

    it('rejects on constructor throw', async () => {
      (global as any).WebSocket = jest.fn(() => {
        throw new Error('Connection refused');
      });
      const b = new HermesBridge('wss://bad.url');
      await expect(b.connect()).rejects.toThrow('Connection refused');
    });
  });

  describe('send', () => {
    it('sends JSON with payload when WebSocket is open', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      const msg: HermesMessage = { type: 'query', payload: 'test', mode: 'personal' };
      bridge.send(msg);

      expect(mockWs.sent.length).toBe(1);
      const parsed = JSON.parse(mockWs.sent[0]);
      expect(parsed.type).toBe('query');
      expect(parsed.payload).toBe('test');
      expect(parsed.mode).toBe('personal');
    });

    it('does not send when WebSocket is not open', () => {
      bridge.send({ type: 'alert', payload: 'x' });
      expect(mockWs.sent.length).toBe(0);
    });
  });

  describe('onMessage', () => {
    it('calls registered handler on message', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      const handler = jest.fn();
      bridge.onMessage(handler);

      const msg: HermesResponse = { type: 'text', payload: 'Hello' };
      mockWs.onmessage?.({ data: JSON.stringify(msg) });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('supports multiple handlers', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      const h1 = jest.fn();
      const h2 = jest.fn();
      bridge.onMessage(h1);
      bridge.onMessage(h2);

      mockWs.onmessage?.({ data: JSON.stringify({ type: 'text', payload: 'Hi' }) });
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('ignores malformed JSON', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      const handler = jest.fn();
      bridge.onMessage(handler);
      expect(() => mockWs.onmessage?.({ data: 'not json' })).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      bridge.disconnect();
      expect(mockWs.readyState).toBe(3);
    });

    it('clears pending reconnect timer when disconnected during close', async () => {
      jest.useFakeTimers();
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      // Simulate close — schedules reconnect via setTimeout
      mockWs.onclose?.();

      // Immediately disconnect — should clear pending timer
      bridge.disconnect();

      // Advance time past the reconnect delay
      jest.advanceTimersByTime(5000);

      // Verify no new WebSocket was created (reconnect was cancelled)
      expect((global as any).WebSocket).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
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
