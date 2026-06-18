/**
 * Legacy bridge adapter over Even Hub SDK.
 *
 * Kept as a fallback and migration path while the custom transport is being
 * adopted. The contract mirrors the shape consumed by Aura runtime code so call
 * sites can stay stable.
 */
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  ImageContainerProperty,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk';
import type {
  AuraBridge,
  AuraBridgeHandler,
  AuraCreateStartUpPageContainer,
  AuraDeviceInfo,
  AuraImageRawDataUpdate,
  AuraTextContainerUpgrade,
} from './types';

export class LegacyBridgeAdapter implements AuraBridge {
  private bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>;

  private constructor(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {
    this.bridge = bridge;
  }

  static async create(): Promise<LegacyBridgeAdapter> {
    const bridge = await waitForEvenAppBridge();
    return new LegacyBridgeAdapter(bridge);
  }

  async createStartUpPageContainer(payload: AuraCreateStartUpPageContainer): Promise<number> {
    const request = new CreateStartUpPageContainer({
      containerTotalNum: payload.containerTotalNum,
      textObject: payload.textObject.map(
        (obj) =>
          new TextContainerProperty({
            containerID: obj.containerID,
            containerName: obj.containerName,
            xPosition: obj.xPosition,
            yPosition: obj.yPosition,
            width: obj.width,
            height: obj.height,
          }),
      ),
      imageObject: payload.imageObject.map(
        (obj) =>
          new ImageContainerProperty({
            containerID: obj.containerID,
            containerName: obj.containerName,
            xPosition: obj.xPosition,
            yPosition: obj.yPosition,
            width: obj.width,
            height: obj.height,
          }),
      ),
    });
    return this.bridge.createStartUpPageContainer(request);
  }

  async textContainerUpgrade(payload: AuraTextContainerUpgrade): Promise<unknown> {
    return this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: payload.containerID,
        containerName: payload.containerName,
        content: payload.content,
      }),
    );
  }

  async updateImageRawData(payload: AuraImageRawDataUpdate): Promise<unknown> {
    return this.bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: payload.containerID,
        containerName: payload.containerName,
        imageData: payload.imageData,
      }),
    );
  }

  async imuControl(enable: boolean, intervalMs: number): Promise<unknown> {
    return this.bridge.imuControl(enable, intervalMs);
  }

  async getDeviceInfo(): Promise<AuraDeviceInfo | null> {
    const info = await this.bridge.getDeviceInfo();
    return (info ?? null) as unknown as AuraDeviceInfo | null;
  }

  onEvenHubEvent(handler: AuraBridgeHandler): () => void {
    return this.bridge.onEvenHubEvent(handler);
  }
}

export class LegacyBridgeFactory {
  async create(): Promise<LegacyBridgeAdapter> {
    return LegacyBridgeAdapter.create();
  }
}
