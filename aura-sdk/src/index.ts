/**
 * Aura SDK — Enhanced Even Hub SDK
 *
 * Forked from @evenrealities/even_hub_sdk.
 * Adds: Arabic/RTL rendering, IMU gestures, Hermes bridge, mode detection.
 *
 * @license MIT
 * @author Aljamri Group
 */

export { Aura } from './aura';
export { ArabicRenderer } from './arabic';
export { GestureEngine } from './gestures';
export { HermesBridge } from './hermes';
export { ModeDetector } from './modes';

export type {
  AuraConfig,
  AuraMode,
  GestureType,
  HermesMessage,
  Language,
  RenderResult,
} from './types';

export {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  DISPLAY_BIT_DEPTH,
  DISPLAY_PIXEL_COUNT,
  FULL_DISPLAY_RECT,
  ValidationError,
  validateDisplayX,
  validateDisplayY,
  validateDisplayW,
  validateDisplayH,
  validateContainerID,
  assertDisplayX,
  assertDisplayY,
  assertDisplayW,
  assertDisplayH,
  assertContainerID,
  validateContainerRect,
  validateUniqueContainerIDs,
  validateContainerCount,
  validateG2Pixels,
  assertG2Pixels,
} from './container-constraints';

export type {
  DisplayX,
  DisplayY,
  DisplayW,
  DisplayH,
  ContainerID,
  G2Pixels,
  G2Rect,
} from './container-constraints';
