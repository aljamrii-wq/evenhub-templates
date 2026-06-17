/**
 * Aura — Main class.
 * Wraps custom transport + Arabic, IMU gestures, Hermes bridge, mode detection.
 */
import type { AuraBridge } from './bridge/types';
import type { AuraConfig, AuraMode, Language, HermesMessage, ModeContext } from './types';
import { ArabicRenderer } from './arabic';
import { EngineClient } from './engine';
import { GestureEngine } from './gestures';
import { HermesBridge } from './hermes';
import { ModeDetector } from './modes';
import { createAuraBridge } from './bridge';

const DEFAULTS: Partial<AuraConfig> = {
  lang: 'ar',
  mode: 'auto',
  hermesUrl: 'wss://hermes.aljamrigroup.com/aura',
  gestures: true,
  alwaysListen: false,
};

export class Aura {
  private bridge: AuraBridge | null = null;
  private arabic: ArabicRenderer;
  private gestures: GestureEngine;
  private hermes: HermesBridge;
  private modes: ModeDetector;
  private config: AuraConfig;
  private ready = false;

  // Container tracking
  private containerId: number | null = null;

  // Callbacks
  private onNodCb: (() => void) | null = null;
  private onShakeCb: (() => void) | null = null;
  private onModeChangeCb: ((ctx: ModeContext) => void) | null = null;
  private onMessageCb: ((msg: HermesMessage) => void) | null = null;
  private onDisconnectCb: (() => void) | null = null;

  // Event unsubscription
  private eventUnsubscribe: (() => void) | null = null;

  constructor(config: Partial<AuraConfig> = {}) {
    this.config = { ...DEFAULTS, ...config } as AuraConfig;
    this.arabic = new ArabicRenderer(
      this.config.lang,
      new EngineClient(this.config.hermesUrl.replace('wss://', 'https://')),
    );
    this.gestures = new GestureEngine();
    this.hermes = new HermesBridge(this.config.hermesUrl);
    this.modes = new ModeDetector();
  }

  /** Initialize: connect to transport + Hermes */
  async init(): Promise<void> {
    const bridge = await createAuraBridge(this.config);
    this.bridge = bridge;

    // Create startup page container (required before any display operations)
    const container = {
      containerTotalNum: 1,
      textObject: [
        {
          containerID: 1,
          containerName: 'aura',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 288,
        },
      ],
      imageObject: [
        {
          containerID: 2,
          containerName: 'aura-img',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 288,
        },
      ],
    };

    const result = await bridge.createStartUpPageContainer(container);
    if (result !== 0) {
      throw new Error(`Failed to create page container: ${result}`);
    }

    // Mode detection from device + time
    if (this.config.mode === 'auto') {
      const info = await bridge.getDeviceInfo();
      const now = new Date();
      if (info) {
        this.modes.start(
          { wearing: info.status?.isWearing, battery: info.status?.batteryLevel },
          now,
        );
      } else {
        // No device info yet — start with default
        this.modes.start({}, now);
      }
      this.modes.onChange((ctx) => this.onModeChangeCb?.(ctx));
    }

    // IMU gesture detection
    if (this.config.gestures) {
      await bridge.imuControl(true, 500);
      this.eventUnsubscribe = bridge.onEvenHubEvent((event) => {
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
    this.hermes.onDisconnect(() => {
      this.ready = false;
      this.onDisconnectCb?.();
    });
    this.ready = true;
  }

  /** Show text on glasses — auto-detects language, renders Arabic as image if needed */
  async show(text: string, lang?: Language): Promise<void> {
    if (!this.bridge) throw new Error('Aura not initialized');
    const language = lang || this.config.lang;
    if (language === 'ar' || language === 'ur' || language === 'fa') {
      // Render as image for RTL/connected scripts
      const pixels = await this.arabic.render(text);
      await this.bridge.updateImageRawData({
        containerID: 2,
        containerName: 'aura-img',
        imageData: Array.from(pixels),
      });
    } else {
      // English text — native rendering via text container upgrade
      await this.bridge.textContainerUpgrade({
        containerID: 1,
        containerName: 'aura',
        content: text,
      });
    }
  }

  /** Ask Hermes — voice question, response on display */
  async ask(question: string, lang?: Language): Promise<void> {
    const msg: HermesMessage = {
      type: 'query',
      text: question,
      lang: lang || this.config.lang,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  /** Send an alert card to display */
  async alert(title: string, body: string, lang?: Language): Promise<void> {
    const msg: HermesMessage = {
      type: 'alert',
      text: `${title}\n${body}`,
      lang: lang || this.config.lang,
      mode: this.modes.current,
    };
    this.hermes.send(msg);
  }

  /** Disconnect from Hermes and clean up resources */
  disconnect(): void {
    this.hermes.disconnect();
    this.ready = false;
    this.modes.stop?.();
    this.eventUnsubscribe?.();
    this.eventUnsubscribe = null;
  }

  // --- Gesture callbacks ---
  onNod(cb: () => void): void { this.onNodCb = cb; }
  onShake(cb: () => void): void { this.onShakeCb = cb; }
  onModeChange(cb: (ctx: ModeContext) => void): void { this.onModeChangeCb = cb; }
  onMessage(cb: (msg: HermesMessage) => void): void { this.onMessageCb = cb; }

  /** Called when Hermes WebSocket disconnects */
  onDisconnect(cb: () => void): void { this.onDisconnectCb = cb; }

  // --- Properties ---
  get currentMode(): AuraMode { return this.modes.current; }

  get isReady(): boolean { return this.ready && this.hermes.isConnected(); }

  get bridgeInstance(): AuraBridge | null { return this.bridge; }

  /** Check if both transport bridge and Hermes WebSocket are connected */
  isBothConnected(): boolean {
    if (!this.bridge) return false;
    return this.hermes.isConnected();
  }

  /** Check if Hermes WebSocket is connected */
  get isHermesConnected(): boolean {
    return this.hermes.isConnected();
  }
}
