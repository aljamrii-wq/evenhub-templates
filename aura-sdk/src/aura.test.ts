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
jest.mock('./hermes', () => ({
  HermesBridge: jest.fn().mockImplementation(() => ({
    connect: mockHermesConnect,
    send: mockHermesSend,
    onMessage: mockHermesOnMessage,
    disconnect: jest.fn(),
  })),
}));

describe('Aura', () => {
  let aura: Aura;

  beforeEach(() => {
    jest.clearAllMocks();
    aura = new Aura();
  });

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      // Defaults are applied internally — verify the object is created
      expect(aura).toBeInstanceOf(Aura);
      expect(aura.isReady).toBe(false);
      expect(aura.currentMode).toBe('personal');
    });

    it('merges partial config with defaults', () => {
      const custom = new Aura({ lang: 'en', gestures: false });
      expect(custom).toBeInstanceOf(Aura);
      expect(custom.currentMode).toBe('personal');
    });
  });

  describe('properties', () => {
    it('isReady returns false before init', () => {
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
      // Just verify no throw
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

      await aura.init();

      expect(aura.isReady).toBe(true);
      expect(aura.bridgeInstance).toBe(mockBridge);
      expect(waitForEvenAppBridge).toHaveBeenCalled();
      expect(mockBridge.createStartUpPageContainer).toHaveBeenCalled();
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
      await aura.init();

      aura.alert('Warning', 'Battery low', 'en');

      expect(mockHermesSend).toHaveBeenCalledTimes(1);
      const sent = mockHermesSend.mock.calls[0][0];
      expect(sent.type).toBe('alert');
      expect(sent.lang).toBe('en');
    });
  });
});
