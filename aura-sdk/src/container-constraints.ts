/**
 * Container Constraints -- Display hardware constants, branded types, and
 * runtime validation for Even Realities G2 smart glasses.
 */

// ---- Display Hardware Constants -------------------------------------------

export const DISPLAY_WIDTH = 576;
export const DISPLAY_HEIGHT = 288;
export const DISPLAY_BIT_DEPTH = 4;
export const DISPLAY_PIXEL_COUNT = DISPLAY_WIDTH * DISPLAY_HEIGHT;

// ---- Branded / Nominal Types -----------------------------------------------

declare const brand: unique symbol;

export type DisplayX = number & { [brand]: 'DisplayX' };
export type DisplayY = number & { [brand]: 'DisplayY' };
export type DisplayW = number & { [brand]: 'DisplayW' };
export type DisplayH = number & { [brand]: 'DisplayH' };
export type ContainerID = number & { [brand]: 'ContainerID' };
export type G2Pixels = Uint8Array & { [brand]: 'G2Pixels' };

export interface G2Rect {
  x: DisplayX;
  y: DisplayY;
  w: DisplayW;
  h: DisplayH;
}

// ---- Validation Error ------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---- Coordinate Validation -------------------------------------------------

export function validateDisplayX(x: number): DisplayX | ValidationError {
  if (!Number.isInteger(x) || x < 0 || x >= DISPLAY_WIDTH) {
    return new ValidationError('DisplayX must be integer 0-' + (DISPLAY_WIDTH - 1) + ', got ' + x);
  }
  return x as DisplayX;
}

export function validateDisplayY(y: number): DisplayY | ValidationError {
  if (!Number.isInteger(y) || y < 0 || y >= DISPLAY_HEIGHT) {
    return new ValidationError('DisplayY must be integer 0-' + (DISPLAY_HEIGHT - 1) + ', got ' + y);
  }
  return y as DisplayY;
}

export function validateDisplayW(w: number): DisplayW | ValidationError {
  if (!Number.isInteger(w) || w < 1 || w > DISPLAY_WIDTH) {
    return new ValidationError('DisplayW must be integer 1-' + DISPLAY_WIDTH + ', got ' + w);
  }
  return w as DisplayW;
}

export function validateDisplayH(h: number): DisplayH | ValidationError {
  if (!Number.isInteger(h) || h < 1 || h > DISPLAY_HEIGHT) {
    return new ValidationError('DisplayH must be integer 1-' + DISPLAY_HEIGHT + ', got ' + h);
  }
  return h as DisplayH;
}

export function validateContainerID(id: number): ContainerID | ValidationError {
  if (!Number.isInteger(id) || id < 1) {
    return new ValidationError('ContainerID must be positive integer, got ' + id);
  }
  return id as ContainerID;
}

// ---- Assertion Helpers -----------------------------------------------------

export function assertDisplayX(x: number): DisplayX {
  if (!Number.isInteger(x) || x < 0 || x >= DISPLAY_WIDTH) {
    throw new RangeError('DisplayX must be integer 0-' + (DISPLAY_WIDTH - 1) + ', got ' + x);
  }
  return x as DisplayX;
}

export function assertDisplayY(y: number): DisplayY {
  if (!Number.isInteger(y) || y < 0 || y >= DISPLAY_HEIGHT) {
    throw new RangeError('DisplayY must be integer 0-' + (DISPLAY_HEIGHT - 1) + ', got ' + y);
  }
  return y as DisplayY;
}

export function assertDisplayW(w: number): DisplayW {
  if (!Number.isInteger(w) || w < 1 || w > DISPLAY_WIDTH) {
    throw new RangeError('DisplayW must be integer 1-' + DISPLAY_WIDTH + ', got ' + w);
  }
  return w as DisplayW;
}

export function assertDisplayH(h: number): DisplayH {
  if (!Number.isInteger(h) || h < 1 || h > DISPLAY_HEIGHT) {
    throw new RangeError('DisplayH must be integer 1-' + DISPLAY_HEIGHT + ', got ' + h);
  }
  return h as DisplayH;
}

export function assertContainerID(id: number): ContainerID {
  if (!Number.isInteger(id) || id < 1) {
    throw new RangeError('ContainerID must be positive integer, got ' + id);
  }
  return id as ContainerID;
}

// ---- Composite Validation --------------------------------------------------

export function validateContainerRect(x: number, y: number, w: number, h: number): G2Rect | ValidationError {
  const vx = validateDisplayX(x);
  if (vx instanceof ValidationError) return vx;
  const vy = validateDisplayY(y);
  if (vy instanceof ValidationError) return vy;
  const vw = validateDisplayW(w);
  if (vw instanceof ValidationError) return vw;
  const vh = validateDisplayH(h);
  if (vh instanceof ValidationError) return vh;

  if (x + w > DISPLAY_WIDTH) {
    return new ValidationError('Container rect x+w (' + x + '+' + w + '=' + (x + w) + ') exceeds display width ' + DISPLAY_WIDTH);
  }
  if (y + h > DISPLAY_HEIGHT) {
    return new ValidationError('Container rect y+h (' + y + '+' + h + '=' + (y + h) + ') exceeds display height ' + DISPLAY_HEIGHT);
  }

  return { x: vx, y: vy, w: vw, h: vh };
}

export function validateUniqueContainerIDs(ids: number[]): number[] {
  const seen = new Set<number>();
  const dupes: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) { dupes.push(id); }
    else { seen.add(id); }
  }
  return dupes;
}

export function validateContainerCount(declared: number, actual: number): ValidationError | null {
  if (declared !== actual) {
    return new ValidationError('containerTotalNum (' + declared + ') does not match actual container count (' + actual + ')');
  }
  return null;
}

// ---- Pixel Data Validation -------------------------------------------------

export function validateG2Pixels(data: Uint8Array): G2Pixels | ValidationError {
  if (data.length !== DISPLAY_PIXEL_COUNT) {
    return new ValidationError('G2 pixel data length must be ' + DISPLAY_PIXEL_COUNT + ', got ' + data.length);
  }
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 15) {
      return new ValidationError('G2 pixel at index ' + i + ' exceeds 4-bit max (value=' + data[i] + ')');
    }
  }
  return data as G2Pixels;
}

export function assertG2Pixels(data: Uint8Array): G2Pixels {
  if (data.length !== DISPLAY_PIXEL_COUNT) {
    throw new RangeError('G2 pixel data length must be ' + DISPLAY_PIXEL_COUNT + ', got ' + data.length);
  }
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 15) {
      throw new RangeError('G2 pixel at index ' + i + ' exceeds 4-bit max (value=' + data[i] + ')');
    }
  }
  return data as G2Pixels;
}

// ---- Pre-validated Constants -----------------------------------------------

export const FULL_DISPLAY_RECT: G2Rect = {
  x: assertDisplayX(0),
  y: assertDisplayY(0),
  w: assertDisplayW(DISPLAY_WIDTH),
  h: assertDisplayH(DISPLAY_HEIGHT),
};
