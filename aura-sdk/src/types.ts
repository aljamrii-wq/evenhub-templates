/** Core types for Aura SDK */

export type Language = 'ar' | 'en' | 'ur' | 'fa' | 'hi';

export type AuraMode = 'flydubai' | 'aljamri' | 'personal' | 'auto';

export type GestureType = 'nod' | 'shake' | 'look-left' | 'look-right' | 'look-down' | 'unknown';

export interface AuraConfig {
  /** Primary language for display */
  lang: Language;
  /** Auto-detect mode or force one */
  mode: AuraMode;
  /** Hermes API endpoint */
  hermesUrl: string;
  /** Enable head gesture detection */
  gestures: boolean;
  /** Enable continuous listening */
  alwaysListen: boolean;
  /** Max ms to wait for GATT service discovery after BLE connect (0 = skip, default: 5000) */
  gattTimeoutMs?: number;
}

export interface HermesMessage {
  type: 'query' | 'alert' | 'card' | 'translate';
  text: string;
  lang: Language;
  mode?: AuraMode;
  data?: Record<string, unknown>;
}

export interface RenderResult {
  /** Raw pixel data for G2 display (576×288, 4-bit greyscale) */
  pixels: Uint8Array;
  /** Width of rendered content */
  width: number;
  /** Height of rendered content */
  height: number;
}

export interface GestureEvent {
  type: GestureType;
  confidence: number;
  timestamp: number;
}

export interface ModeContext {
  mode: AuraMode;
  confidence: number;
  reason: string;
}

// Re-export BLE security types — defined in ble.ts but re-exported
// from types.ts for clean import paths.
export type { BleSecurityConfig, BleSecurityState } from './ble';
