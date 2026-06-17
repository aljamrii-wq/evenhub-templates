import type { G2Pixels } from './container-constraints';

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
  /** Hermes WebSocket endpoint (e.g. wss://hermes.aljamrigroup.com/ws/aura) */
  hermesUrl: string;
  /** Auth token for engine WebSocket (passed via subprotocol aura-token.xxx) */
  token?: string;
  /** Enable head gesture detection */
  gestures: boolean;
  /** Enable continuous listening */
  alwaysListen: boolean;
}

/** Message sent from SDK to aura-engine via WebSocket (after HELLO handshake).
 *  Matches engine's AuraMessage model: { type, payload, mode }. */
export interface HermesMessage {
  type: 'query' | 'alert' | 'mode_switch';
  payload: string;
  version?: number;
  mode?: AuraMode;
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

/** Response from aura-engine via WebSocket.
 *  Matches engine's AuraResponse model: { type: 'text'|'bitmap'|'error', payload }. */
export interface HermesResponse {
  type: 'text' | 'bitmap' | 'error';
  payload: string;
}

/** Alias for HermesResponse — used by Aura class. */
export type AuraResponse = HermesResponse;

export interface RenderResult {
  /**
   * Raw pixel data for G2 display (576x288, 4-bit greyscale).
   * Validate at call sites with assertG2Pixels() from container-constraints.
   */
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
