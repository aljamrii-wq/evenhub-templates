import { Aura } from './aura';

// Mock Even Hub SDK
jest.mock('@evenrealities/even_hub_sdk', () => ({
  waitForEvenAppBridge: jest.fn(),
  CreateStartUpPageContainer: jest.fn(),
  TextContainerUpgrade: jest.fn(),
  ImageRawDataUpdate: jest.fn(),
  ImageContainerProperty: jest.fn(),
  TextContainerProperty: jest.fn(),
}));

// Mock sub-modules
jest.mock('./hermes', () => ({
  HermesBridge: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn(),
    onMessage: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

jest.mock('./gestures', () => ({
  GestureEngine: jest.fn().mockImplementation(() => ({
    process: jest.fn().mockReturnValue({ type: 'unknown', confidence: 0, timestamp: 0 }),
  })),
}));

jest.mock('./modes', () => ({
  ModeDetector: jest.fn().mockImplementation(() => ({
    _current: 'personal',
    get current() { return this._current; },
    start: jest.fn(),
    stop: jest.fn(),
    onChange: jest.fn(),
    forceMode: jest.fn(function(mode: string) { this._current = mode; }),
  })),
}));

jest.mock('./arabic', () => ({
  ArabicRenderer: jest.fn().mockImplementation(() => ({
    render: jest.fn().mockResolvedValue(new Uint8Array([0, 1, 2, 3])),
  })),
}));

describe('Aura', () => {
  let aura: Aura;

  beforeEach(() => {
    aura = new Aura();
  });

  describe('constructor', () => {
    it('creates an instance with defaults', () => {
      expect(aura).toBeDefined();
      expect(aura.isReady).toBe(false);
      expect(aura.currentMode).toBe('personal');
      expect(aura.bridgeInstance).toBeNull();
    });

    it('accepts partial config overrides', () => {
      const configured = new Aura({ lang: 'en', mode: 'flydubai' });
      expect(configured).toBeDefined();
    });
  });

  describe('currentMode', () => {
    it('returns personal by default', () => {
      expect(aura.currentMode).toBe('personal');
    });
  });

  describe('isReady', () => {
    it('returns false before init', () => {
      expect(aura.isReady).toBe(false);
    });
  });

  describe('bridgeInstance', () => {
    it('returns null before init', () => {
      expect(aura.bridgeInstance).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('onNod registers without firing', () => {
      const cb = jest.fn();
      expect(() => aura.onNod(cb)).not.toThrow();
    });

    it('onShake registers without firing', () => {
      const cb = jest.fn();
      expect(() => aura.onShake(cb)).not.toThrow();
    });

    it('onModeChange registers without firing', () => {
      const cb = jest.fn();
      expect(() => aura.onModeChange(cb)).not.toThrow();
    });

    it('onMessage registers without firing', () => {
      const cb = jest.fn();
      expect(() => aura.onMessage(cb)).not.toThrow();
    });
  });
});
