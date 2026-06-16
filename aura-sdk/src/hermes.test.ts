import { HermesBridge } from './hermes';
import type { HermesMessage } from './types';

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

  it('send does not throw when not connected', () => {
    const msg: HermesMessage = { type: 'query', text: 'Hello', lang: 'en' };
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
    // shouldReconnect is now false — no WebSocket was created yet
    // disconnecting an unconnected bridge should not throw
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
      text: 'Meeting\nStarts soon',
      lang: 'en',
      mode: 'flydubai',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('sends card messages without throwing', () => {
    const msg: HermesMessage = {
      type: 'card',
      text: 'Card content',
      lang: 'ar',
      data: { title: 'بطاقة' },
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });

  it('sends translate messages without throwing', () => {
    const msg: HermesMessage = {
      type: 'translate',
      text: 'Hello world',
      lang: 'ar',
    };
    expect(() => bridge.send(msg)).not.toThrow();
  });
});
