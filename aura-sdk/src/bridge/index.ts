import type { AuraBridge } from './types';
import type { AuraConfig } from '../types';
import { LegacyBridgeFactory } from './legacy';
import { CustomBridgeAdapter } from './custom';

export type {
  AuraBridge,
  AuraBridgeMode,
  AuraBridgeHandler,
  AuraDeviceInfo,
  AuraImageRawDataUpdate,
  AuraTextContainerUpgrade,
} from './types';

function getMode(config: AuraConfig): 'legacy' | 'custom' {
  return config.bridgeMode || 'legacy';
}

export class AuraBridgeError extends Error {
  code: string;
  constructor(message: string, code: string = 'bridge_error') {
    super(message);
    this.name = 'AuraBridgeError';
    this.code = code;
  }
}

class CustomBridgeFactory {
  private config: { endpoint: string; namespace?: string; pollMs?: number };

  constructor(config: { endpoint: string; namespace?: string; pollMs?: number }) {
    this.config = config;
  }

  async create(): Promise<AuraBridge> {
    if (!this.config.endpoint) {
      throw new AuraBridgeError(
        'Custom bridge endpoint is required when bridgeMode=custom',
        'bridge_endpoint_missing',
      );
    }
    return CustomBridgeAdapter.create(this.config);
  }
}

export async function createAuraBridge(config: AuraConfig): Promise<AuraBridge> {
  const mode = getMode(config);
  if (mode === 'custom') {
    const customEndpoint =
      config.bridgeUrl ||
      config.hermesUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    const factory = new CustomBridgeFactory({
      endpoint: customEndpoint,
      namespace: config.bridgeNamespace,
      pollMs: config.bridgePollMs,
    });
    return factory.create();
  }
  const legacy = new LegacyBridgeFactory();
  return legacy.create();
}
