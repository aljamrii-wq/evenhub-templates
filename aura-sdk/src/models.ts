/**
 * Type-safe model wrappers for Even Hub SDK.
 *
 * The upstream @evenrealities/even_hub_sdk defines static fromJson(json: any)
 * on every model class, which silently accepts null, numbers, strings, etc.
 * without a compile error.
 *
 * This module provides:
 *   - JsonObject: a proper JSON object type (rejects null, primitives)
 *   - Typed fromJson factory functions for each Even Hub model used by Aura
 *
 * Usage: import { TextContainerProperty, fromJson_TextContainerProperty } from './models'
 */

import {
  CreateStartUpPageContainer as _CreateStartUpPageContainer,
  TextContainerProperty as _TextContainerProperty,
  ImageContainerProperty as _ImageContainerProperty,
  TextContainerUpgrade as _TextContainerUpgrade,
  ImageRawDataUpdate as _ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk';

import type { JsonObject } from './types';

// ---------------------------------------------------------------------------
// Re-export Even Hub model classes (unmodified constructors)
// ---------------------------------------------------------------------------

export const CreateStartUpPageContainer = _CreateStartUpPageContainer;
export type CreateStartUpPageContainer = _CreateStartUpPageContainer;

export const TextContainerProperty = _TextContainerProperty;
export type TextContainerProperty = _TextContainerProperty;

export const ImageContainerProperty = _ImageContainerProperty;
export type ImageContainerProperty = _ImageContainerProperty;

export const TextContainerUpgrade = _TextContainerUpgrade;
export type TextContainerUpgrade = _TextContainerUpgrade;

export const ImageRawDataUpdate = _ImageRawDataUpdate;
export type ImageRawDataUpdate = _ImageRawDataUpdate;

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Validate and narrow input to JsonObject at runtime.
 * Prevents null, numbers, strings, arrays, and other non-object values
 * from being silently passed to Even Hub's fromJson.
 */
function assertJsonObject(input: unknown, label: string): JsonObject {
  if (input === null) {
    throw new TypeError(`${label}: expected a JSON object, got null`);
  }
  if (typeof input !== 'object') {
    throw new TypeError(`${label}: expected a JSON object, got ${typeof input}`);
  }
  if (Array.isArray(input)) {
    throw new TypeError(`${label}: expected a JSON object, got an array`);
  }
  return input as JsonObject;
}

// ---------------------------------------------------------------------------
// Typed fromJson functions
// Each accepts JsonObject (not any) — compile error on null / 42 / 'hello'
// ---------------------------------------------------------------------------

export function fromJson_CreateStartUpPageContainer(json: JsonObject): _CreateStartUpPageContainer {
  return _CreateStartUpPageContainer.fromJson(assertJsonObject(json, 'CreateStartUpPageContainer.fromJson'));
}

export function fromJson_TextContainerProperty(json: JsonObject): _TextContainerProperty {
  return _TextContainerProperty.fromJson(assertJsonObject(json, 'TextContainerProperty.fromJson'));
}

export function fromJson_ImageContainerProperty(json: JsonObject): _ImageContainerProperty {
  return _ImageContainerProperty.fromJson(assertJsonObject(json, 'ImageContainerProperty.fromJson'));
}

export function fromJson_TextContainerUpgrade(json: JsonObject): _TextContainerUpgrade {
  return _TextContainerUpgrade.fromJson(assertJsonObject(json, 'TextContainerUpgrade.fromJson'));
}

export function fromJson_ImageRawDataUpdate(json: JsonObject): _ImageRawDataUpdate {
  return _ImageRawDataUpdate.fromJson(assertJsonObject(json, 'ImageRawDataUpdate.fromJson'));
}
