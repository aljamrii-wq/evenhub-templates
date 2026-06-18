/**
 * HermesBridge — WebSocket connection to aura-engine backend.
 * 
 * Sends queries/alerts from glasses, receives responses for display.
 * Supports auto-reconnect with exponential backoff.
 * Auth: passes token via WebSocket subprotocol (aura-token.xxx) for
 *       browser-style runtimes that cannot set custom headers.
 */

import type { HermesMessage, HermesResponse } from './types';

type MessageHandler = (msg: HermesResponse) => void;

export class HermesBridge {
  private url: string;
  private token: string | undefined;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token?: string) {
    this.url = url;
    this.token = token;
  }

  /** Connect to Hermes WebSocket */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocols = this.token ? [`aura-token.${this.token}`] : undefined;
        this.ws = new WebSocket(this.url, protocols);

        this.ws.onopen = () => {
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: HermesResponse = JSON.parse(event.data);
            for (const handler of this.handlers) {
              handler(msg);
            }
          } catch {
            // Skip malformed messages
          }
        };

        this.ws.onclose = () => {
          if (this.shouldReconnect) {
            this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
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

  /** Send a message to Hermes */
  send(msg: HermesMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Register message handler */
  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /** Disconnect — clears pending reconnect timer and closes the WebSocket */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
