/**
 * HermesBridge — WebSocket connection to aura-engine backend.
 *
 * Sends queries/alerts from glasses, receives responses for display.
 * Supports auto-reconnect with exponential backoff.
 */
import type { HermesMessage } from './types';

type MessageHandler = (msg: HermesMessage) => void;
type DisconnectHandler = () => void;

export class HermesBridge {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private connected = false;

  constructor(url: string) {
    this.url = url;
  }

  /** Connect to Hermes WebSocket */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectDelay = 1000;
          resolve();
        };
        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const msg: HermesMessage = JSON.parse(event.data as string);
            for (const handler of this.handlers) {
              handler(msg);
            }
          } catch {
            // Skip malformed messages
          }
        };
        this.ws.onclose = () => {
          const wasConnected = this.connected;
          this.connected = false;
          // Notify disconnect handlers
          if (wasConnected) {
            for (const handler of this.disconnectHandlers) {
              try {
                handler();
              } catch { /* ignore handler errors */ }
            }
          }
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

  /** Register disconnect handler — called when the WebSocket closes */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  /** Check if WebSocket is currently connected */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Disconnect */
  disconnect(): void {
    this.shouldReconnect = false;
    this.connected = false;
    this.ws?.close();
    this.ws = null;
  }
}
