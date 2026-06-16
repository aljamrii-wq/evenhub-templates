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

/** Engine API response types */

export interface EngineHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  modes: AuraMode[];
}

export interface EngineRenderRequest {
  text: string;
  lang: Language;
  size?: number;
  width?: number;
  height?: number;
}

export interface EngineRenderResponse {
  /** Raw pixel data as base64-encoded bytes */
  data: string;
  width: number;
  height: number;
  format: 'greyscale' | '4bit';
}

export interface EngineModeResponse {
  mode: AuraMode;
  confidence: number;
  reason: string;
}

export interface EngineTranslateRequest {
  text: string;
  from: Language;
  to: Language;
}

export interface EngineTranslateResponse {
  text: string;
  from: Language;
  to: Language;
}
