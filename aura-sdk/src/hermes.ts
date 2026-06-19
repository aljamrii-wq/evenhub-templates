/**
 * HermesBridge — WebSocket connection to aura-engine backend.
 *
 * Sends queries/alerts from glasses, receives responses for display.
 *
 * Lifecycle:
 *   - On open, sends a HELLO frame and resolves connect() (optimistic — the
 *     socket is usable immediately).
 *   - A hello_ack from the engine completes the handshake: `isReady` flips true
 *     and the negotiated protocol `version` is recorded.
 *   - If the socket closes before connect() has settled, connect() rejects with
 *     "WebSocket closed during handshake".
 *   - After a successful connection drops, reconnects with exponential backoff.
 *
 * Auth: passes the token via the WebSocket subprotocol (aura-token.xxx) for
 *       browser-style runtimes that cannot set custom headers.
 */

import type {
  HermesMessage,
  HermesResponse,
  HelloMessage,
  HelloResponse,
} from './types';
import { PROTOCOL_VERSION } from './types';

type MessageHandler = (msg: HermesResponse) => void;
type DisconnectHandler = () => void;

export class HermesBridge {
  private url: string;
  private token: string | undefined;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Negotiated protocol version (set on hello_ack). Undefined until acked. */
  version: number | undefined;

  // Handshake / connect() settlement state.
  private _ready = false;
  private _settled = true;
  private _resolveConnect: (() => void) | null = null;
  private _rejectConnect: ((err: Error) => void) | null = null;

  constructor(url: string, token?: string) {
    this.url = url;
    this.token = token;
  }

  /** True once the engine has acknowledged the HELLO handshake. */
  get isReady(): boolean {
    return this._ready;
  }

  /** Connect to Hermes and perform the HELLO handshake. */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._settled = false;
      this._resolveConnect = resolve;
      this._rejectConnect = reject;

      let ws: WebSocket;
      try {
        const protocols = this.token ? [`aura-token.${this.token}`] : undefined;
        ws = new WebSocket(this.url, protocols);
      } catch (e) {
        this._settle(() => reject(e instanceof Error ? e : new Error(String(e))));
        return;
      }
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectDelay = 1000;
        this._sendHello();
        // Resolve optimistically, but deferred to a native promise microtask so
        // a synchronous close during the handshake can reject first (see
        // onclose). A native microtask (not queueMicrotask/timer) so it still
        // flushes on `await` even when timers are faked in tests.
        Promise.resolve().then(() => {
          this._settle(() => this._resolveConnect?.());
        });
      };

      ws.onmessage = (event) => {
        let parsed: HermesResponse | HelloResponse;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return; // Skip malformed messages
        }
        if (parsed && (parsed as HelloResponse).type === 'hello_ack') {
          this._ready = true;
          this.version = (parsed as HelloResponse).version;
          return; // Handshake frame — not a display message
        }
        if (parsed && (parsed as HelloResponse).type === 'hello_error') {
          this._ready = false;
          return;
        }
        for (const handler of this.handlers) {
          handler(parsed as HermesResponse);
        }
      };

      ws.onclose = () => {
        const shouldNotifyDisconnect = this._ready && this.shouldReconnect;
        this._ready = false;
        // A close before connect() settled means the handshake never completed.
        if (!this._settled) {
          this._settle(() =>
            this._rejectConnect?.(new Error('WebSocket closed during handshake')),
          );
        }
        if (shouldNotifyDisconnect) {
          for (const handler of this.disconnectHandlers) {
            try { handler(); } catch { /* ignore handler errors */ }
          }
        }
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this._reconnect(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
        }
      };

      ws.onerror = () => {
        if (!this._settled) {
          this._settle(() =>
            this._rejectConnect?.(new Error('WebSocket connection failed')),
          );
        }
      };
    });
  }

  /** Send a message to Hermes (no-op if the socket is not ready). */
  send(msg: HermesMessage): void {
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify(msg));
    }
  }

  /** Register a message handler. */
  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /** Register a disconnect handler. */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  /** True when the WebSocket is open and the HELLO handshake has completed. */
  isConnected(): boolean {
    return this.ws?.readyState === 1 && this._ready;
  }

  /** Disconnect — cancels reconnect and closes the socket. */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  // --- internals ---

  private _settle(action: () => void): void {
    if (this._settled) return;
    this._settled = true;
    action();
  }

  private _sendHello(): void {
    const hello: HelloMessage = {
      type: 'hello',
      version: PROTOCOL_VERSION,
      client: 'aura-sdk',
      capabilities: {},
    };
    try {
      this.ws?.send(JSON.stringify(hello));
    } catch {
      // Send failures surface via onclose/onerror.
    }
  }

  /** Reconnect attempt — swallows rejections so dropped sockets never produce
   *  an unhandled promise rejection. */
  private _reconnect(): void {
    this.reconnectTimer = null;
    if (!this.shouldReconnect) return;
    this.connect().catch(() => {
      // Backoff continues via the next onclose.
    });
  }
}
