// Mock Even Hub SDK for unit tests — no real imports to avoid circular resolution

export const waitForEvenAppBridge = jest.fn();

export class EvenAppBridge {
  static getInstance(): EvenAppBridge { return new EvenAppBridge(); }
  _ready = true;
  get ready(): boolean { return this._ready; }
  getUserInfo = jest.fn();
  getDeviceInfo = jest.fn();
  createStartUpPageContainer = jest.fn();
  rebuildPageContainer = jest.fn();
  updateImageRawData = jest.fn();
  textContainerUpgrade = jest.fn();
  audioControl = jest.fn();
  imuControl = jest.fn();
  shutDownPageContainer = jest.fn();
  onLaunchSource = jest.fn(() => () => {});
  onDeviceStatusChanged = jest.fn(() => () => {});
  onEvenHubEvent = jest.fn(() => () => {});
}

// Stub classes used by aura.ts
export class CreateStartUpPageContainer { constructor(_?: any) {} }
export class TextContainerUpgrade { constructor(_?: any) {} }
export class ImageRawDataUpdate { constructor(_?: any) {} }
export class ImageContainerProperty { constructor(_?: any) {} }
export class TextContainerProperty { constructor(_?: any) {} }
