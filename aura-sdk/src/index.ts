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
export { EngineClient } from './engine';
export { GestureEngine } from './gestures';
export { HermesBridge } from './hermes';
export { ModeDetector } from './modes';

export type {
  AuraConfig,
  AuraMode,
  EngineHealthResponse,
  EngineModeResponse,
  EngineRenderRequest,
  EngineRenderResponse,
  EngineTranslateRequest,
  EngineTranslateResponse,
  GestureType,
  HermesMessage,
  Language,
  RenderResult,
} from './types';
