/** Core types for Aura SDK */

export type Language = 'ar' | 'en' | 'ur' | 'fa' | 'hi';

export type AuraMode = 'flydubai' | 'aljamri' | 'personal' | 'auto';

export type GestureType = 'nod' | 'shake' | 'look-left' | 'look-right' | 'look-down' | 'unknown';

export interface AuraConfig {
  /** Primary language for display */
  lang: Language;
  /** Auto-detect mode or force one */
  mode: AuraMode;
  /** Hermes WebSocket endpoint (e.g. wss://hermes.aljamrigroup.com/ws/aura) */
  hermesUrl: string;
  /** Auth token for Hermes WebSocket (passed via subprotocol aura-token.xxx) */
  token?: string;
  /** Enable head gesture detection */
  gestures: boolean;
  /** Enable continuous listening */
  alwaysListen: boolean;
}

/** Message sent from SDK to aura-engine via WebSocket.
 *  Matches engine's AuraMessage model: { type, payload, mode }. */
export interface HermesMessage {
  type: 'query' | 'alert' | 'mode_switch';
  payload: string;
  mode?: AuraMode;
}

/** Response from aura-engine via WebSocket.
 *  Matches engine's AuraResponse model: { type: 'text'|'bitmap'|'error', payload }. */
export interface HermesResponse {
  type: 'text' | 'bitmap' | 'error';
  payload: string;
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
