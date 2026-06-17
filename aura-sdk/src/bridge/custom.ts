/**
 * Custom Aura bridge transport.
 *
 * This is a standalone, Even SDK-free path intended for replacement efforts.
 */
import type {
  AuraBridge,
  AuraBridgeHandler,
  AuraCreateStartUpPageContainer,
  AuraDeviceInfo,
  AuraImageRawDataUpdate,
  AuraTextContainerUpgrade,
} from './types';

export interface CustomBridgeConfig {
  /** Base URL for HTTP/WS transport, e.g. https://aura-runtime.example.com */
  endpoint: string;
  /** Optional namespace to avoid collisions if backend hosts multiple apps */
  namespace?: string;
  /** Poll interval for compatibility shim updates */
  pollMs?: number;
}

function isBrowserLike(): boolean {
  return typeof window !== 'undefined';
}

export class CustomBridgeAdapter implements AuraBridge {
  private eventToken = 0;
  private endpoint: string;
  private namespace: string;
  private pollMs: number;

  private constructor(config: CustomBridgeConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.namespace = config.namespace || 'default';
    this.pollMs = config.pollMs ?? 1200;
  }

  static async create(config: CustomBridgeConfig): Promise<CustomBridgeAdapter> {
    return new CustomBridgeAdapter(config);
  }

  async createStartUpPageContainer(payload: AuraCreateStartUpPageContainer): Promise<number> {
    const raw = await this.request<number>('createStartUpPageContainer', {
      namespace: this.namespace,
      ...payload,
    });
    return raw;
  }

  async textContainerUpgrade(payload: AuraTextContainerUpgrade): Promise<unknown> {
    return this.request('textContainerUpgrade', {
      namespace: this.namespace,
      ...payload,
    });
  }

  async updateImageRawData(payload: AuraImageRawDataUpdate): Promise<unknown> {
    return this.request('updateImageRawData', {
      namespace: this.namespace,
      ...payload,
    });
  }

  async imuControl(enable: boolean, intervalMs: number): Promise<unknown> {
    return this.request('imuControl', {
      namespace: this.namespace,
      enable,
      intervalMs,
    });
  }

  async getDeviceInfo(): Promise<AuraDeviceInfo | null> {
    return this.request<AuraDeviceInfo | null>('getDeviceInfo', {
      namespace: this.namespace,
    });
  }

  onEvenHubEvent(handler: AuraBridgeHandler): () => void {
    if (!isBrowserLike() || !window.__AURA_BRIDGE__) {
      // no-op shim for non-browser / early bootstrap environments
      return () => undefined;
    }
    const bus = window.__AURA_BRIDGE__;
    if (typeof bus.subscribe === 'function') {
      return bus.subscribe((event: unknown) => {
        handler(event as Parameters<AuraBridgeHandler>[0]);
      });
    }

    let timer = window.setInterval(async () => {
      try {
        const events = await this.pollEvents();
        events.forEach((event) => {
          handler(event);
        });
      } catch {
        // Intentionally swallowed: transport errors are surfaced via init and send paths.
      }
    }, this.pollMs);

    return () => {
      window.clearInterval(timer);
    };
  }

  private async pollEvents(): Promise<Array<{ type: string; payload: unknown }>> {
    try {
      const resp = await fetch(
        `${this.endpoint}/events?namespace=${encodeURIComponent(this.namespace)}`,
      );
      if (!resp.ok) {
        return [];
      }
      const json = (await resp.json()) as { events?: Array<{ type: string; payload: unknown }> };
      return (json?.events || []).map((event) => ({
        type: event.type || 'unknown',
        payload: event.payload || {},
      }));
    } catch {
      return [];
    }
  }

  private async request<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const requestId = ++this.eventToken;
    const envelope = {
      id: requestId,
      action,
      payload,
    };
    const response = await fetch(`${this.endpoint}/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) {
      throw new Error(`Aura custom bridge request failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { ok: boolean; result: T; error?: string };
    if (!body?.ok) {
      throw new Error(body.error || `Aura custom bridge action ${action} failed`);
    }
    return body.result;
  }
}

declare global {
  interface Window {
    __AURA_BRIDGE__?: {
      subscribe?: (handler: (event: unknown) => void) => () => void;
    };
  }
}
