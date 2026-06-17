import { Aura } from './aura';
import type { AuraConfig, HermesMessage, ModeContext } from './types';

// Mock the SDK module
jest.mock('@evenrealities/even_hub_sdk', () => ({
  waitForEvenAppBridge: jest.fn(),
  CreateStartUpPageContainer: class {},
  TextContainerUpgrade: class {},
  ImageRawDataUpdate: class {},
  ImageContainerProperty: class {},
  TextContainerProperty: class {},
}));

const {
  waitForEvenAppBridge,
} = require('@evenrealities/even_hub_sdk');

// Mock ArabicRenderer
jest.mock('./arabic', () => ({
  ArabicRenderer: jest.fn().mockImplementation(() => ({
    render: jest.fn().mockResolvedValue(new Uint8Array([0, 1, 2, 3])),
  })),
}));

// Mock HermesBridge
const mockHermesConnect = jest.fn().mockResolvedValue(undefined);
const mockHermesSend = jest.fn();
const mockHermesOnMessage = jest.fn();
const mockHermesOnDisconnect = jest.fn();
const mockHermesIsConnected = jest.fn().mockReturnValue(false);
const mockHermesDisconnect = jest.fn();
jest.mock('./hermes', () => ({
  HermesBridge: jest.fn().mockImplementation(() => ({
    connect: mockHermesConnect,
    send: mockHermesSend,
    onMessage: mockHermesOnMessage,
    onDisconnect: mockHermesOnDisconnect,
    isConnected: mockHermesIsConnected,
    disconnect: mockHermesDisconnect,
  })),
}));

describe('Aura', () => {
  let aura: Aura;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHermesIsConnected.mockReturnValue(false);
    aura = new Aura();
  });

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      expect(aura).toBeInstanceOf(Aura);
      expect(aura.currentMode).toBe('personal');
    });

    it('merges partial config with defaults', () => {
      const custom = new Aura({ lang: 'en', gestures: false });
      expect(custom).toBeInstanceOf(Aura);
      expect(custom.currentMode).toBe('personal');
    });
  });

  describe('properties', () => {
    it('isReady returns false before init (Hermes not connected)', () => {
      // isReady = this.ready && this.hermes.isConnected()
      // ready=false, isConnected=false → false
      expect(aura.isReady).toBe(false);
    });

    it('isReady returns false when ready but Hermes not connected', () => {
      // Even if ready flag were true, mock isConnected returns false
      expect(aura.isReady).toBe(false);
    });

    it('currentMode returns personal by default', () => {
      expect(aura.currentMode).toBe('personal');
    });

    it('bridgeInstance is null before init', () => {
      expect(aura.bridgeInstance).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('onNod registers a callback', () => {
      const cb = jest.fn();
      aura.onNod(cb);
    });

    it('onShake registers a callback', () => {
      const cb = jest.fn();
      aura.onShake(cb);
    });

    it('onModeChange registers a callback', () => {
      const cb = jest.fn();
      aura.onModeChange(cb);
    });

    it('onMessage registers a callback', () => {
      const cb = jest.fn();
      aura.onMessage(cb);
    });

    it('onDisconnect registers a callback', () => {
      const cb = jest.fn();
      aura.onDisconnect(cb);
    });
  });

  describe('init', () => {
    it('initializes and becomes ready', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);

      await aura.init();

      expect(aura.isReady).toBe(true);
      expect(aura.bridgeInstance).toBe(mockBridge);
      expect(waitForEvenAppBridge).toHaveBeenCalled();
      expect(mockBridge.createStartUpPageContainer).toHaveBeenCalled();
    });

    it('registers onDisconnect handler during init', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);

      await aura.init();

      expect(mockHermesOnDisconnect).toHaveBeenCalledTimes(1);
      expect(typeof mockHermesOnDisconnect.mock.calls[0][0]).toBe('function');
    });

    it('throws if container creation fails', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(1),
        getDeviceInfo: jest.fn(),
        imuControl: jest.fn(),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);

      await expect(aura.init()).rejects.toThrow('Failed to create page container: 1');
    });
  });

  describe('show', () => {
    it('throws if not initialized', async () => {
      await expect(aura.show('Hello')).rejects.toThrow('Aura not initialized');
    });

    it('shows English text via text container upgrade', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
        textContainerUpgrade: jest.fn().mockResolvedValue(undefined),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      await aura.show('Hello World', 'en');
      expect(mockBridge.textContainerUpgrade).toHaveBeenCalled();
    });

    it('shows Arabic text via image render', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
        updateImageRawData: jest.fn().mockResolvedValue(undefined),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      await aura.show('مرحبا', 'ar');
      expect(mockBridge.updateImageRawData).toHaveBeenCalled();
    });
  });

  describe('ask', () => {
    it('sends a query message to Hermes', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      aura.ask('What time is it?', 'ar');

      expect(mockHermesSend).toHaveBeenCalledTimes(1);
      const sent = mockHermesSend.mock.calls[0][0];
      expect(sent.type).toBe('query');
      expect(sent.text).toBe('What time is it?');
      expect(sent.lang).toBe('ar');
    });
  });

  describe('alert', () => {
    it('sends an alert message to Hermes', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      aura.alert('Warning', 'Battery low', 'en');

      expect(mockHermesSend).toHaveBeenCalledTimes(1);
      const sent = mockHermesSend.mock.calls[0][0];
      expect(sent.type).toBe('alert');
      expect(sent.lang).toBe('en');
    });
  });

  describe('isBothConnected', () => {
    it('returns false before init (bridge is null)', () => {
      expect(aura.isBothConnected()).toBe(false);
    });

    it('returns false when bridge exists but Hermes is not connected', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(false);
      await aura.init();

      expect(aura.isBothConnected()).toBe(false);
    });

    it('returns true when both bridge and Hermes are connected', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      expect(aura.isBothConnected()).toBe(true);
    });

    it('returns false when only Hermes is connected but bridge is null', () => {
      mockHermesIsConnected.mockReturnValue(true);
      expect(aura.isBothConnected()).toBe(false);
    });
  });

  describe('isHermesConnected', () => {
    it('returns false when Hermes is not connected', () => {
      mockHermesIsConnected.mockReturnValue(false);
      expect(aura.isHermesConnected).toBe(false);
    });

    it('returns true when Hermes is connected', () => {
      mockHermesIsConnected.mockReturnValue(true);
      expect(aura.isHermesConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('cleans up Hermes, modes, and event subscriptions', async () => {
      const mockBridge = {
        createStartUpPageContainer: jest.fn().mockResolvedValue(0),
        getDeviceInfo: jest.fn().mockResolvedValue({
          status: { isWearing: true, batteryLevel: 80 },
        }),
        imuControl: jest.fn().mockResolvedValue(undefined),
        onEvenHubEvent: jest.fn(() => () => {}),
      };
      waitForEvenAppBridge.mockResolvedValue(mockBridge);
      mockHermesIsConnected.mockReturnValue(true);
      await aura.init();

      aura.disconnect();

      expect(mockHermesDisconnect).toHaveBeenCalled();
      expect(aura.isReady).toBe(false);
    });
  });
});
