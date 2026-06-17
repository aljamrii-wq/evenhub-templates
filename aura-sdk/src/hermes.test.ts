import { HermesBridge } from './hermes';
import type { HermesMessage } from './types';

const OrigWebSocket = global.WebSocket;

class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((ev?: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sentMessages: string[] = [];

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) { this.url = url; }
  send(data: string): void { this.sentMessages.push(data); }
  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

class MockMessageEvent {
  data: string;
  constructor(data: string) { this.data = data; }
}

describe('HermesBridge', () => {
  let wsMockFn: jest.Mock;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    mockWs = new MockWebSocket('wss://test.example.com/ws');
    wsMockFn = jest.fn(() => mockWs as any);
    (global as any).WebSocket = wsMockFn;
    (global as any).WebSocket.CONNECTING = 0;
    (global as any).WebSocket.OPEN = 1;
    (global as any).WebSocket.CLOSING = 2;
    (global as any).WebSocket.CLOSED = 3;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.WebSocket = OrigWebSocket;
  });

  describe('connect', () => {
    it('resolves when WebSocket onopen fires', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await expect(connectPromise).resolves.toBeUndefined();
      expect(wsMockFn).toHaveBeenCalledWith('wss://test.example.com/ws');
    });

    it('rejects on WebSocket error', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.onerror?.(new Event('error'));
      await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
    });
  });

  describe('send', () => {
    it('sends JSON message when socket is open', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      const msg: HermesMessage = {
        type: 'query', text: 'What time is it?', lang: 'ar', mode: 'flydubai',
      };
      bridge.send(msg);
      expect(mockWs.sentMessages).toHaveLength(1);
      const sent = JSON.parse(mockWs.sentMessages[0]);
      expect(sent.type).toBe('query');
      expect(sent.text).toBe('What time is it?');
      expect(sent.lang).toBe('ar');
    });

    it('does not send when socket is not open', () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      bridge.send({ type: 'query', text: 'test', lang: 'en' });
      expect(mockWs.sentMessages).toHaveLength(0);
    });
  });

  describe('onMessage', () => {
    it('calls handler when message received', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler = jest.fn();
      bridge.onMessage(handler);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      const msg: HermesMessage = { type: 'card', text: 'Hello', lang: 'en' };
      mockWs.onmessage?.(new MockMessageEvent(JSON.stringify(msg)) as any);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toEqual(msg);
    });

    it('handles multiple message handlers', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bridge.onMessage(handler1);
      bridge.onMessage(handler2);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      const msg: HermesMessage = { type: 'alert', text: 'Alert!', lang: 'ar' };
      mockWs.onmessage?.(new MockMessageEvent(JSON.stringify(msg)) as any);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('skips malformed JSON', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler = jest.fn();
      bridge.onMessage(handler);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      mockWs.onmessage?.(new MockMessageEvent('not json') as any);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onDisconnect', () => {
    it('registers a disconnect handler', () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler = jest.fn();
      bridge.onDisconnect(handler);
      // handler registered without error
    });

    it('calls handler when WebSocket closes after being connected', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler = jest.fn();
      bridge.onDisconnect(handler);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      mockWs.onclose?.();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not call handler on close if never connected', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler = jest.fn();
      bridge.onDisconnect(handler);
      // connect() is never resolved — readyState stays CONNECTING
      bridge.connect();
      mockWs.onclose?.();
      expect(handler).not.toHaveBeenCalled();
    });

    it('handles multiple disconnect handlers', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bridge.onDisconnect(handler1);
      bridge.onDisconnect(handler2);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      mockWs.onclose?.();
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('ignores errors thrown by disconnect handlers', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const badHandler = jest.fn().mockImplementation(() => { throw new Error('handler error'); });
      const goodHandler = jest.fn();
      bridge.onDisconnect(badHandler);
      bridge.onDisconnect(goodHandler);
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      mockWs.onclose?.();
      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnect', () => {
    it('retries connection on close', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      const initialCalls = wsMockFn.mock.calls.length;
      mockWs.onclose?.();
      jest.advanceTimersByTime(1000);
      expect(wsMockFn.mock.calls.length).toBe(initialCalls + 1);
    });
  });

  describe('disconnect', () => {
    it('stops reconnection when explicitly disconnected', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      bridge.disconnect();
      const callsBefore = wsMockFn.mock.calls.length;
      jest.advanceTimersByTime(30000);
      expect(wsMockFn.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('isConnected', () => {
    it('returns false before connecting', () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      expect(bridge.isConnected()).toBe(false);
    });

    it('returns true when WebSocket is open', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      expect(bridge.isConnected()).toBe(true);
    });

    it('returns false when WebSocket is not open (CONNECTING)', () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      bridge.connect(); // fire-and-forget, readyState is 0 (CONNECTING)
      expect(bridge.isConnected()).toBe(false);
    });

    it('returns false after disconnect', async () => {
      const bridge = new HermesBridge('wss://test.example.com/ws');
      const connectPromise = bridge.connect();
      mockWs.readyState = MockWebSocket.OPEN;
      mockWs.onopen?.();
      await connectPromise;

      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);
    });
  });
});
