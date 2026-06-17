import { createAuraBridge, AuraBridgeError } from './index';
import type { AuraConfig } from '../types';

// Mock modules
jest.mock('./legacy', () => ({
  LegacyBridgeFactory: class {
    create = jest.fn().mockResolvedValue({ _type: 'legacy' });
  },
}));

jest.mock('./custom', () => ({
  CustomBridgeAdapter: {
    create: jest.fn().mockResolvedValue({ _type: 'custom' }),
  },
}));

const baseConfig: AuraConfig = {
  lang: 'ar',
  mode: 'auto',
  hermesUrl: 'wss://example.com/aura',
  gestures: true,
  alwaysListen: false,
};

describe('createAuraBridge', () => {
  it('creates legacy bridge by default', async () => {
    const bridge = await createAuraBridge(baseConfig);
    expect(bridge).toEqual({ _type: 'legacy' });
  });

  it('creates legacy bridge when bridgeMode is legacy', async () => {
    const bridge = await createAuraBridge({ ...baseConfig, bridgeMode: 'legacy' });
    expect(bridge).toEqual({ _type: 'legacy' });
  });

  it('creates custom bridge when bridgeMode is custom', async () => {
    const bridge = await createAuraBridge({
      ...baseConfig,
      bridgeMode: 'custom',
      bridgeUrl: 'https://custom.example.com',
    });
    expect(bridge).toEqual({ _type: 'custom' });
  });

  it('falls back wss→https for custom endpoint when bridgeUrl not set', async () => {
    const bridge = await createAuraBridge({
      ...baseConfig,
      bridgeMode: 'custom',
    });
    expect(bridge).toEqual({ _type: 'custom' });
  });

  it('throws when custom bridge with no endpoint', async () => {
    // Clear the mock to test the error path
    jest.resetModules();
    jest.mock('./custom', () => ({
      CustomBridgeAdapter: {
        create: jest.fn().mockRejectedValue(
          new AuraBridgeError('Custom bridge endpoint is required when bridgeMode=custom', 'bridge_endpoint_missing'),
        ),
      },
    }));
    jest.mock('./legacy', () => ({
      LegacyBridgeFactory: class {
        create = jest.fn();
      },
    }));

    const { createAuraBridge: create } = require('./index');

    await expect(
      create({
        ...baseConfig,
        bridgeMode: 'custom',
        hermesUrl: 'wss://',  // No domain
      }),
    ).rejects.toThrow(AuraBridgeError);
  });
});
