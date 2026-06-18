/**
 * Aura — Main class.
 * Wraps Even Hub SDK with Arabic, IMU gestures, Hermes bridge, mode detection.
 */

import {
  waitForEvenAppBridge,
  type EvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  ImageContainerProperty,
  TextContainerProperty,
  type DeviceInfo,
} from '@evenrealities/even_hub_sdk';
import { ArabicRenderer } from './arabic';
import { GestureEngine } from './gestures';
import { HermesBridge } from './hermes';
import { ModeDetector } from './modes';

import type { AuraConfig, AuraMode, Language, HermesMessage, HermesResponse, GestureEvent, ModeContext } from './types';

const DEFAULTS: AuraConfig = {
  lang: 'ar',
  mode: 'auto',
  hermesUrl: 'wss://hermes.aljamrigroup.com/ws/aura',
  gestures: true,
  alwaysListen: false,
};

export class Aura {
  private bridge: EvenAppBridge | null = null;
  private arabic: ArabicRenderer;
  private gestures: GestureEngine;
  private hermes: HermesBridge;
  private modes: ModeDetector;
  private config: AuraConfig;
  private ready = false;
  private disposed = false;

  // Container tracking
  private containerId: number | null = null;

  // Callbacks
  private onNodCb: (() => void) | null = null;
  private onShakeCb: (() => void) | null = null;
  private onModeChangeCb: ((mode: ModeContext) => void) | null = null;
  private onMessageCb: ((msg: HermesResponse) => void) | null = null;

  constructor(config: Partial<AuraConfig> = {}) {
    this.config = { ...DEFAULTS, ...config };
    // Derive HTTP render URL from WebSocket URL.
    // wss:// → https://, ws:// → http://, then swap /ws/aura → /render
    const renderUrl = this.config.hermesUrl
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace(/\/ws\/aura$/, '/render');
    this.arabic = new ArabicRenderer(this.config.lang, renderUrl);
    this.gestures = new GestureEngine();
    this.hermes = new HermesBridge(this.config.hermesUrl, this.config.token);
    this.modes = new ModeDetector();
  }

  /** Initialize: connect to Even bridge + Hermes */
  async init(): Promise<void> {
    if (this.disposed) throw new Error('Aura has been disposed');
    this.bridge = await waitForEvenAppBridge();

    // Create startup page container (required before any display operations)
    const container = new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [new TextContainerProperty({
        containerID: 1,
        containerName: 'aura',
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
      })],
      imageObject: [new ImageContainerProperty({
        containerID: 2,
        containerName: 'aura-img',
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
      })],
    });
    const result = await this.bridge.createStartUpPageContainer(container);
    if (result !== 0) {
      throw new Error(`Failed to create page container: ${result}`);
    }

    // Mode detection from device + time
    if (this.config.mode === 'auto') {
      const info = await this.bridge.getDeviceInfo();
      const now = new Date();
      if (info) {
        this.modes.start(
          { wearing: info.status?.isWearing, battery: info.status?.batteryLevel },
          now
        );
      } else {
        // No device info yet — start with default
        this.modes.start({}, now);
      }
      this.modes.onChange((ctx) => this.onModeChangeCb?.(ctx));
    } else {
      // Force the configured mode (not 'auto')
      this.modes.forceMode(this.config.mode as AuraMode);
    }

    // IMU gesture detection
    if (this.config.gestures) {
      await this.bridge.imuControl(true, 500);
      this.bridge.onEvenHubEvent((event) => {
        if (this.disposed) return;
        const imu = event.sysEvent?.imuData;
        if (imu) {
          const x = imu.x ?? 0;
          const y = imu.y ?? 0;
          const z = imu.z ?? 0;
          const gesture = this.gestures.process(x, y, z);
          if (gesture.type === 'nod') this.onNodCb?.();
          if (gesture.type === 'shake') this.onShakeCb?.();
        }
      });
    }

    // Hermes connection
    await this.hermes.connect();
    this.hermes.onMessage((msg) => this.onMessageCb?.(msg));

    this.ready = true;
  }

  /** Dispose all persistent resources — call before re-init or teardown.
   *  Stops mode-detection timer, disconnects WebSocket, stops IMU,
   *  nulls all callbacks, and releases the Even bridge. Safe to call
   *  multiple times; idempotent after the first call. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.modes.stop();
    this.hermes.disconnect();

    // Stop IMU streaming if active
    if (this.bridge) {
      this.bridge.imuControl(false).catch(() => {});
    }

    // Null callbacks so stale event listeners are no-ops
    this.onNodCb = null;
    this.onShakeCb = null;
    this.onModeChangeCb = null;
    this.onMessageCb = null;

    this.ready = false;
    this.bridge = null;
  }

  /** Show text on glasses — auto-detects language, renders Arabic as image if needed */
  async show(text: string, lang?: Language): Promise<void> {
    if (this.disposed) throw new Error('Aura has been disposed');
    if (!this.bridge) throw new Error('Aura not initialized');

    const language = lang || this.config.lang;

    if (language === 'ar' || language === 'ur' || language === 'fa') {
      // Render as image for RTL/connected scripts
      const pixels = await this.arabic.render(text, undefined, language);
      const update = new ImageRawDataUpdate({
        containerID: 2,
        containerName: 'aura-img',
        imageData: Array.from(pixels),
      });
      await this.bridge.updateImageRawData(update);
    } else {
      // English text — native rendering via text container upgrade
      const upgrade = new TextContainerUpgrade({
        containerID: 1,
        containerName: 'aura',
        content: text,
      });
      await this.bridge.textContainerUpgrade(upgrade);
    }
  }

  /** Ask Hermes — voice question, response on display */
  async ask(question: string, lang?: Language): Promise<void> {
    if (this.disposed) throw new Error('Aura has been disposed');
    const msg: HermesMessage = {
      type: 'query',
      payload: question,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  /** Send an alert card to display */
  async alert(title: string, body: string, lang?: Language): Promise<void> {
    if (this.disposed) throw new Error('Aura has been disposed');
    const msg: HermesMessage = {
      type: 'alert',
      payload: `${title}\n${body}`,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  // --- Gesture callbacks ---

  onNod(cb: () => void): void { this.onNodCb = cb; }
  onShake(cb: () => void): void { this.onShakeCb = cb; }
  onModeChange(cb: (mode: ModeContext) => void): void { this.onModeChangeCb = cb; }
  onMessage(cb: (msg: HermesResponse) => void): void { this.onMessageCb = cb; }

  // --- Properties ---

  get currentMode(): AuraMode { return this.modes.current; }
  get isReady(): boolean { return this.ready && !this.disposed; }
  get bridgeInstance(): EvenAppBridge | null { return this.bridge; }
}
