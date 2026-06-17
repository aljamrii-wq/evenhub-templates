import { HermesBridge } from './hermes';
import type { HermesMessage } from './types';

class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; this.onclose?.(); }
}

describe('HermesBridge', () => {
  let bridge: HermesBridge;
  let mockWs: MockWebSocket;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket('wss://test.example.com/ws');
    (global as any).WebSocket = jest.fn(() => mockWs);
    (global as any).WebSocket.CONNECTING = 0;
    (global as any).WebSocket.OPEN = 1;
    (global as any).WebSocket.CLOSING = 2;
    (global as any).WebSocket.CLOSED = 3;
    bridge = new HermesBridge('wss://test.example.com/ws');
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    bridge.disconnect();
  });

  describe('constructor', () => {
    it('stores the URL', () => {
      const b = new HermesBridge('wss://custom.url/ws');
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
    it('sends JSON when WebSocket is open', async () => {
      const connectPromise = bridge.connect();
      mockWs.readyState = 1;
      mockWs.onopen?.();
      await connectPromise;

      const msg: HermesMessage = { type: 'query', text: 'test', lang: 'ar' };
      bridge.send(msg);

      expect(mockWs.sent.length).toBe(1);
      const parsed = JSON.parse(mockWs.sent[0]);
      expect(parsed.type).toBe('query');
      expect(parsed.text).toBe('test');
    });

    it('does not send when WebSocket is not open', () => {
      bridge.send({ type: 'alert', text: 'x', lang: 'en' });
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

      const msg: HermesMessage = { type: 'card', text: 'Hello', lang: 'en' };
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

      mockWs.onmessage?.({ data: JSON.stringify({ type: 'query', text: 'Hi', lang: 'en' }) });
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
});
