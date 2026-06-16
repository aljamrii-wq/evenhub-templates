// Mock Even Hub SDK for unit tests — no real imports to avoid circular resolution

export const waitForEvenAppBridge = jest.fn();

export const OsEventTypeList = {
  CLICK_EVENT: 0,
  DOUBLE_CLICK_EVENT: 1,
  LONG_PRESS_EVENT: 2,
  SYSTEM_EXIT_EVENT: 3,
  ABNORMAL_EXIT_EVENT: 4,
};

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
  imuControl = jest.fn().mockResolvedValue(undefined);
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
