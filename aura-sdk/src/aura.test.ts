import { Aura } from './aura';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

const mockHermesConnect = jest.fn().mockResolvedValue(undefined);
const mockHermesSend = jest.fn();
const mockHermesOnMessage = jest.fn();
const mockHermesOnDisconnect = jest.fn();
const mockHermesDisconnect = jest.fn();
const mockHermesIsConnected = jest.fn().mockReturnValue(false);

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
    connect: mockHermesConnect,
    send: mockHermesSend,
    onMessage: mockHermesOnMessage,
    onDisconnect: mockHermesOnDisconnect,
    disconnect: mockHermesDisconnect,
    isConnected: mockHermesIsConnected,
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
    jest.clearAllMocks();
    mockHermesConnect.mockResolvedValue(undefined);
    mockHermesIsConnected.mockReturnValue(false);
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

    it('onDisconnect registers without firing', () => {
      const cb = jest.fn();
      expect(() => aura.onDisconnect(cb)).not.toThrow();
    });
  });

  describe('connection lifecycle', () => {
    const mockBridge = {
      createStartUpPageContainer: jest.fn().mockResolvedValue(0),
      getDeviceInfo: jest.fn().mockResolvedValue(null),
      onEvenHubEvent: jest.fn().mockReturnValue(jest.fn()),
      imuControl: jest.fn().mockResolvedValue(undefined),
      updateImageRawData: jest.fn().mockResolvedValue(undefined),
      textContainerUpgrade: jest.fn().mockResolvedValue(undefined),
      shutDownPageContainer: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      (waitForEvenAppBridge as jest.Mock).mockResolvedValue(mockBridge);
    });

    it('registers a Hermes disconnect handler during init', async () => {
      await aura.init();

      expect(mockHermesOnDisconnect).toHaveBeenCalledWith(expect.any(Function));
    });

    it('returns false from isBothConnected before init', () => {
      mockHermesIsConnected.mockReturnValue(true);

      expect(aura.isBothConnected()).toBe(false);
    });

    it('returns false from isBothConnected when Hermes is not connected', async () => {
      mockHermesIsConnected.mockReturnValue(false);
      await aura.init();

      expect(aura.isBothConnected()).toBe(false);
    });

    it('returns true from isBothConnected when bridge and Hermes are connected', async () => {
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      expect(aura.isBothConnected()).toBe(true);
    });

    it('exposes Hermes connection state', () => {
      mockHermesIsConnected.mockReturnValueOnce(false).mockReturnValueOnce(true);

      expect(aura.isHermesConnected).toBe(false);
      expect(aura.isHermesConnected).toBe(true);
    });

    it('disconnect callback marks Aura not ready', async () => {
      const cb = jest.fn();
      aura.onDisconnect(cb);
      await aura.init();
      const handler = mockHermesOnDisconnect.mock.calls[0][0];

      handler();

      expect(cb).toHaveBeenCalled();
      expect(aura.isReady).toBe(false);
    });
  });
});
