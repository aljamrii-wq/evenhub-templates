/**
 * Canonical transport contracts for the custom Aura runtime bridge.
 *
 * This layer intentionally mirrors the minimal Even Hub shape we actually use in
 * the SDK, so legacy and custom transport implementations can evolve independently.
 */

export type AuraBridgeMode = 'legacy' | 'custom';

export interface AuraImuVector {
  x?: number;
  y?: number;
  z?: number;
}

export interface AuraSysEvent {
  imuData?: AuraImuVector;
}

export interface AuraEvent {
  sysEvent?: AuraSysEvent;
  [key: string]: unknown;
}

export interface AuraDeviceStatus {
  isWearing?: boolean;
  batteryLevel?: number;
}

export interface AuraDeviceInfo {
  status?: AuraDeviceStatus;
  [key: string]: unknown;
}

export interface AuraCreateStartUpPageContainer {
  containerTotalNum: number;
  textObject: Array<{
    containerID: number;
    containerName: string;
    xPosition: number;
    yPosition: number;
    width: number;
    height: number;
  }>;
  imageObject: Array<{
    containerID: number;
    containerName: string;
    xPosition: number;
    yPosition: number;
    width: number;
    height: number;
  }>;
}

export interface AuraTextContainerUpgrade {
  containerID: number;
  containerName: string;
  content: string;
}

export interface AuraImageRawDataUpdate {
  containerID: number;
  containerName: string;
  imageData: number[];
}

export type AuraBridgeHandler = (event: AuraEvent) => void;

export interface AuraBridge {
  createStartUpPageContainer(payload: AuraCreateStartUpPageContainer): Promise<number>;
  textContainerUpgrade(payload: AuraTextContainerUpgrade): Promise<unknown>;
  updateImageRawData(payload: AuraImageRawDataUpdate): Promise<unknown>;
  imuControl(enable: boolean, intervalMs: number): Promise<unknown>;
  getDeviceInfo(): Promise<AuraDeviceInfo | null>;
  onEvenHubEvent(handler: AuraBridgeHandler): () => void;
}

export interface AuraBridgeFactory {
  create(): Promise<AuraBridge>;
}
