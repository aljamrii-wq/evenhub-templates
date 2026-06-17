/**
 * HermesBridge — WebSocket connection to aura-engine backend.
 *
 * Sends queries/alerts from glasses, receives responses for display.
 * Performs HELLO handshake for protocol version negotiation on connect.
 * Supports auto-reconnect with exponential backoff.
 */

import type { HermesMessage, HelloMessage, HelloResponse, AuraResponse } from './types';
import { PROTOCOL_VERSION } from './types';

type MessageHandler = (msg: AuraResponse) => void;

export class HermesBridge {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private negotiatedVersion: number | null = null;
  private handshakeResolve: (() => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /** The protocol version negotiated with the server, or null before handshake. */
  get version(): number | null {
    return this.negotiatedVersion;
  }

  /** Whether the HELLO handshake has completed successfully. */
  get isReady(): boolean {
    return this.negotiatedVersion !== null;
  }

  /** Connect to Hermes WebSocket with HELLO handshake. */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          // Send HELLO handshake
          const hello: HelloMessage = {
            type: 'hello',
            version: PROTOCOL_VERSION,
            client: 'aura-sdk/0.1.0',
            capabilities: { render: true, mode_detection: true },
          };
          this.ws!.send(JSON.stringify(hello));

          // Handshake resolves after server hello_ack
          this.handshakeResolve = resolve;
          this.handshakeReject = reject;
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            // Handle handshake response
            if (msg.type === 'hello_ack') {
              this.negotiatedVersion = msg.version;
              this.reconnectDelay = 1000;
              this.handshakeResolve?.();
              this.handshakeResolve = null;
              this.handshakeReject = null;
              return;
            }

            if (msg.type === 'hello_error') {
              const err = new Error(
                `Handshake rejected: ${msg.error} (server supports v${msg.supported_versions?.join(', ')})`
              );
              this.handshakeReject?.(err);
              this.handshakeResolve = null;
              this.handshakeReject = null;
              this.ws?.close(4000, msg.error);
              return;
            }

            // Normal message — only dispatch after handshake
            if (this.negotiatedVersion !== null) {
              const response: AuraResponse = msg;
              for (const handler of this.handlers) {
                handler(response);
              }
            }
          } catch {
            // Skip malformed messages
          }
        };

        this.ws.onclose = () => {
          this.negotiatedVersion = null;
          // Reject pending handshake
          this.handshakeReject?.(new Error('WebSocket closed during handshake'));
          this.handshakeResolve = null;
          this.handshakeReject = null;

          if (this.shouldReconnect) {
            setTimeout(() => this.connect(), this.reconnectDelay);
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
          }
        };

        this.ws.onerror = () => {
          reject(new Error('WebSocket connection failed'));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Send a message to Hermes (requires completed handshake). */
  send(msg: HermesMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.negotiatedVersion !== null) {
      this.ws.send(JSON.stringify({ ...msg, version: this.negotiatedVersion }));
    }
  }

  /** Register message handler (receives AuraResponse objects). */
  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /** Disconnect */
  disconnect(): void {
    this.shouldReconnect = false;
    this.negotiatedVersion = null;
    this.handshakeResolve = null;
    this.handshakeReject = null;
    this.ws?.close();
    this.ws = null;
  }
}
