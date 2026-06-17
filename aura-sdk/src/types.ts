/** Core types for Aura SDK */

export type Language = 'ar' | 'en' | 'ur' | 'fa' | 'hi';

export type AuraMode = 'flydubai' | 'aljamri' | 'personal' | 'auto';

export type GestureType = 'nod' | 'shake' | 'look-left' | 'look-right' | 'look-down' | 'unknown';

/** Current wire protocol version — bump when message format changes. */
export const PROTOCOL_VERSION = 1;

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

/** Message sent to aura-engine WebSocket (after HELLO handshake). */
export interface HermesMessage {
  type: 'query' | 'alert' | 'mode_switch';
  payload: string;
  version: number;
  mode: AuraMode;
}

/** HELLO message sent on WebSocket connect. */
export interface HelloMessage {
  type: 'hello';
  version: number;
  client: string;
  capabilities: Record<string, unknown>;
}

/** Server response to HELLO handshake. */
export interface HelloResponse {
  type: 'hello_ack' | 'hello_error';
  version: number;
  server: string;
  capabilities?: Record<string, unknown>;
  supported_versions?: number[];
  error?: string;
}

/** Response from aura-engine WebSocket. */
export interface AuraResponse {
  type: 'text' | 'bitmap' | 'error';
  payload: string;
}

export interface RenderResult {
  /** Raw pixel data for G2 display (576x288, 4-bit greyscale) */
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
