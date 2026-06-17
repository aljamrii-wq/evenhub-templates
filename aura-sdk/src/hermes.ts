/**
 * HermesBridge — WebSocket connection to aura-engine backend.
 * 
 * Sends queries/alerts from glasses, receives responses for display.
 * Supports auto-reconnect with exponential backoff.
 */

import type { HermesMessage } from './types';

type MessageHandler = (msg: HermesMessage) => void;

export class HermesBridge {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /** Connect to Hermes WebSocket */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: HermesMessage = JSON.parse(event.data);
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

  /** Disconnect */
  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }
}
