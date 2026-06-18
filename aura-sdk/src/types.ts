import type { G2Pixels } from './container-constraints';
import type { AuraBridgeMode } from './bridge/types';

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

  // --- Bridge transport selection (optional) ---
  /** Which transport to use: 'legacy' (Even Hub SDK, default) or 'custom'. */
  bridgeMode?: AuraBridgeMode;
  /** Base HTTP(S) URL for the custom bridge. Falls back to a host derived
   *  from hermesUrl when omitted. */
  bridgeUrl?: string;
  /** Namespace for the custom bridge, to isolate multiple apps on one backend. */
  bridgeNamespace?: string;
  /** Poll interval (ms) for the custom bridge compatibility shim. */
  bridgePollMs?: number;
}

// --- Engine REST client contracts (aura-engine HTTP API) ---

/** Response from GET /health. */
export interface EngineHealthResponse {
  status: string;
  version: string;
  uptime: number;
  modes: string[];
}

/** Request body for POST /render. */
export interface EngineRenderRequest {
  text: string;
  lang: Language;
  size?: number;
  width?: number;
  height?: number;
}

/** Response from POST /render. */
export interface EngineRenderResponse {
  /** Base64-encoded packed pixel data. */
  data: string;
  width: number;
  height: number;
  /** Pixel format identifier, e.g. '4bit'. */
  format: string;
}

/** Response from POST /mode. */
export interface EngineModeResponse {
  mode: string;
  confidence: number;
  reason: string;
}

/** Request body for POST /translate. */
export interface EngineTranslateRequest {
  text: string;
  from: string;
  to: string;
}

/** Response from POST /translate. */
export interface EngineTranslateResponse {
  text: string;
  from: string;
  to: string;
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
