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

// Stub classes used by aura.ts — mirror Even Hub SDK shape
export class CreateStartUpPageContainer {
  constructor(_?: Record<string, unknown>) {}
  static fromJson(_: Record<string, unknown>): CreateStartUpPageContainer { return new CreateStartUpPageContainer(); }
}
export class TextContainerUpgrade {
  constructor(_?: Record<string, unknown>) {}
  static fromJson(_: Record<string, unknown>): TextContainerUpgrade { return new TextContainerUpgrade(); }
}
export class ImageRawDataUpdate {
  constructor(_?: Record<string, unknown>) {}
  static fromJson(_: Record<string, unknown>): ImageRawDataUpdate { return new ImageRawDataUpdate(); }
}
export class ImageContainerProperty {
  constructor(_?: Record<string, unknown>) {}
  static fromJson(_: Record<string, unknown>): ImageContainerProperty { return new ImageContainerProperty(); }
}
export class TextContainerProperty {
  constructor(_?: Record<string, unknown>) {}
  static fromJson(_: Record<string, unknown>): TextContainerProperty { return new TextContainerProperty(); }
}
