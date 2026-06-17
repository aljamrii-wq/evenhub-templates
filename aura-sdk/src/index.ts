/**
 * Aura SDK — Enhanced Even Hub SDK
 * 
 * Forked from @evenrealities/even_hub_sdk.
 * Adds: Arabic/RTL rendering, IMU gestures, Hermes bridge, mode detection,
 * BLE security enforcement.
 * 
 * @license MIT
 * @author Aljamri Group
 */

export { Aura } from './aura';
export { ArabicRenderer } from './arabic';
export {
  BleSecurityLevel,
  BleDataType,
  DEFAULT_BLE_SECURITY,
  STRICT_BLE_SECURITY,
  BLE_GATT_UUIDS,
  BLE_DATA_SENSITIVITY,
  validateBleSecurity,
  formatBleSecurityReport,
} from './ble';
export { GestureEngine } from './gestures';
export { HermesBridge } from './hermes';
export { ModeDetector } from './modes';

// Type-safe model wrappers (replaces direct @evenrealities imports)
export {
  CreateStartUpPageContainer,
  TextContainerProperty,
  ImageContainerProperty,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  fromJson_CreateStartUpPageContainer,
  fromJson_TextContainerProperty,
  fromJson_ImageContainerProperty,
  fromJson_TextContainerUpgrade,
  fromJson_ImageRawDataUpdate,
} from './models';

export type {
  JsonObject,
  AuraConfig,
  AuraMode,
  BleSecurityConfig,
  BleSecurityState,
  GestureType,
  HermesMessage,
  Language,
  RenderResult,
} from './types';
