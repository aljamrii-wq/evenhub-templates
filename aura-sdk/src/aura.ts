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
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk';
import { ArabicRenderer } from './arabic';
import { GestureEngine } from './gestures';
import { HermesBridge } from './hermes';
import { ModeDetector } from './modes';
import {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  validateContainerRect,
  validateUniqueContainerIDs,
  validateContainerCount,
  type ContainerID,
  type G2Rect,
} from './container-constraints';
import { assertPayloadSize } from './mtu';

import type { AuraConfig, AuraMode, Language, HermesMessage, AuraResponse, GestureEvent, ModeContext } from './types';
import { PROTOCOL_VERSION } from './types';

const DEFAULTS: AuraConfig = {
  lang: 'ar',
  mode: 'auto',
  hermesUrl: 'wss://hermes.aljamrigroup.com/ws/aura',
  gestures: true,
  alwaysListen: false,
};

/** Full-screen container rectangle — validated once at module load */
const FULL_SCREEN_RECT: G2Rect = validateContainerRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT) as G2Rect;

export class Aura {
  private bridge: EvenAppBridge | null = null;
  private arabic: ArabicRenderer;
  private gestures: GestureEngine;
  private hermes: HermesBridge;
  private modes: ModeDetector;
  private config: AuraConfig;
  private ready = false;

  // Container tracking
  private containerId: ContainerID | null = null;

  // Cleanup handles
  private eventUnsubscribe: (() => void) | null = null;
  private disposed = false;

  // Callbacks
  private onNodCb: (() => void) | null = null;
  private onShakeCb: (() => void) | null = null;
  private onModeChangeCb: ((mode: ModeContext) => void) | null = null;
  private onMessageCb: ((msg: AuraResponse) => void) | null = null;
  private onDisconnectCb: (() => void) | null = null;
  private onExitCb: (() => void) | null = null;

  constructor(config: Partial<AuraConfig> = {}) {
    this.config = { ...DEFAULTS, ...config };
        // Derive HTTP render URL from WebSocket URL.
    // wss:// → https://, ws:// → http://, then swap /ws/aura → /render
    const renderUrl = this.config.hermesUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/ws\/aura$/, "/render");
    this.arabic = new ArabicRenderer(this.config.lang, renderUrl);
    this.gestures = new GestureEngine();
        this.hermes = new HermesBridge(this.config.hermesUrl, this.config.token);
    this.modes = new ModeDetector();
  }

  /** Initialize: connect to Even bridge + Hermes */
  async init(): Promise<void> {
    if (this.disposed) throw new Error('Aura has been disposed');
    this.bridge = await waitForEvenAppBridge();

    // --- Container definitions with validated rect ---

    const textContainer = new TextContainerProperty({
      containerID: 1,
      containerName: 'aura',
      xPosition: FULL_SCREEN_RECT.x,
      yPosition: FULL_SCREEN_RECT.y,
      width: FULL_SCREEN_RECT.w,
      height: FULL_SCREEN_RECT.h,
    });

    const imageContainer = new ImageContainerProperty({
      containerID: 2,
      containerName: 'aura-img',
      xPosition: FULL_SCREEN_RECT.x,
      yPosition: FULL_SCREEN_RECT.y,
      width: FULL_SCREEN_RECT.w,
      height: FULL_SCREEN_RECT.h,
    });

    const containerIDs = [1, 2];
    const totalContainers = containerIDs.length; // 2

    // --- Runtime validation (enforce what was previously JSDoc-only) ---

    // Check container count matches
    const countErr = validateContainerCount(totalContainers, totalContainers);
    if (countErr) throw countErr;

    // Check for duplicate container IDs
    const dupes = validateUniqueContainerIDs(containerIDs);
    if (dupes.length > 0) {
      throw new Error('Duplicate container IDs: ' + dupes.join(', '));
    }

    // Check each container rect fits within the display
    const rectCheck = validateContainerRect(
      FULL_SCREEN_RECT.x,
      FULL_SCREEN_RECT.y,
      FULL_SCREEN_RECT.w,
      FULL_SCREEN_RECT.h,
    );
    if (rectCheck instanceof Error) throw rectCheck;

    // Create startup page container
    const container = new CreateStartUpPageContainer({
      containerTotalNum: totalContainers,
      textObject: [textContainer],
      imageObject: [imageContainer],
    });
    const result = await this.bridge.createStartUpPageContainer(container);
    if (result !== 0) {
      throw new Error('Failed to create page container: ' + result);
    }

    // Always register OS event handling (double-tap exit, system lifecycle)
    this.eventUnsubscribe = this.bridge.onEvenHubEvent((event: any) => {
      const sysType = event.sysEvent?.eventType ?? null;
      const textType = event.textEvent?.eventType ?? null;

      // Double-tap exits the app from any event envelope
      if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
          textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        this.onExitCb?.();
        this.bridge?.shutDownPageContainer(1);
        return;
      }

      // System lifecycle events — clean up
      if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
          sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
        this.dispose();
        return;
      }

      // IMU gesture detection
      if (this.config.gestures) {
        const imu = event.sysEvent?.imuData;
        if (imu) {
          const x = imu.x ?? 0;
          const y = imu.y ?? 0;
          const z = imu.z ?? 0;
          const gesture = this.gestures.process(x, y, z);
          if (gesture.type === 'nod') this.onNodCb?.();
          if (gesture.type === 'shake') this.onShakeCb?.();
        }
      }
    });

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
    }

    // Enable IMU if gesture detection is on
    if (this.config.gestures) {
      await this.bridge.imuControl(true, 500);
    }

    // Hermes connection. The display path must work even when the AI backend
    // is unreachable, so a failed connect degrades gracefully (HermesBridge
    // keeps retrying with backoff) instead of failing init().
    this.hermes.onMessage((msg) => this.onMessageCb?.(msg));
    this.hermes.onDisconnect(() => {
      this.ready = false;
      this.onDisconnectCb?.();
    });
    try {
      await this.hermes.connect();
    } catch (err) {
      console.warn('[aura] Hermes connect failed; continuing offline:', err);
    }

    this.ready = true;
  }

  /** Dispose all resources — stops intervals, disconnects WebSocket, cleans up bridge */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Stop mode detection interval
    this.modes.stop();

    // Disconnect Hermes WebSocket
    this.hermes.disconnect();

    // Unsubscribe from Even Hub events
    this.eventUnsubscribe?.();
    this.eventUnsubscribe = null;

    // Disable IMU
    if (this.bridge && this.config.gestures) {
      this.bridge.imuControl(false, 500).catch(() => {});
    }

    // Null callbacks so stale event listeners are no-ops
    this.onNodCb = null;
    this.onShakeCb = null;
    this.onModeChangeCb = null;
    this.onMessageCb = null;
    this.onDisconnectCb = null;
    this.onExitCb = null;

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
      assertPayloadSize(pixels, { context: 'Arabic render bitmap' });
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
    const msg: HermesMessage = {
      type: 'query',
      payload: question,
      version: this.hermes.version ?? PROTOCOL_VERSION,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  /** Send an alert card to display */
  async alert(title: string, body: string, lang?: Language): Promise<void> {
    const msg: HermesMessage = {
      type: 'alert',
      payload: title + '\n' + body,
      version: this.hermes.version ?? PROTOCOL_VERSION,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  // --- Gesture callbacks ---

  onNod(cb: () => void): void { this.onNodCb = cb; }
  onShake(cb: () => void): void { this.onShakeCb = cb; }
  onModeChange(cb: (mode: ModeContext) => void): void { this.onModeChangeCb = cb; }
  onMessage(cb: (msg: AuraResponse) => void): void { this.onMessageCb = cb; }

  /** Register callback for Hermes disconnects. */
  onDisconnect(cb: () => void): void { this.onDisconnectCb = cb; }

  /** Register callback for app exit (double-tap or system-initiated) */
  onExit(cb: () => void): void { this.onExitCb = cb; }

  // --- Properties ---

  get currentMode(): AuraMode { return this.modes.current; }
  get isReady(): boolean { return this.ready; }
  get bridgeInstance(): EvenAppBridge | null { return this.bridge; }

  /** True when both the Even Hub bridge exists and Hermes is connected. */
  isBothConnected(): boolean {
    return this.bridge !== null && this.hermes.isConnected();
  }

  /** True when Hermes WebSocket is connected and protocol-ready. */
  get isHermesConnected(): boolean {
    return this.hermes.isConnected();
  }
}
