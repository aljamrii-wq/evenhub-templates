/**
 * Container Constraints tests — validates branded types, validation,
 * and assertion functions for G2 display layout enforcement.
 */

import {
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

describe('Display constants', () => {
  it('has correct display dimensions', () => {
    expect(DISPLAY_WIDTH).toBe(576);
    expect(DISPLAY_HEIGHT).toBe(288);
    expect(DISPLAY_BIT_DEPTH).toBe(4);
    expect(DISPLAY_PIXEL_COUNT).toBe(576 * 288);
  });
});

describe('validateDisplayX', () => {
  it('accepts valid values', () => {
    expect(validateDisplayX(0)).not.toBeInstanceOf(ValidationError);
    expect(validateDisplayX(575)).not.toBeInstanceOf(ValidationError);
    expect(validateDisplayX(288)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects negative', () => {
    expect(validateDisplayX(-1)).toBeInstanceOf(ValidationError);
  });

  it('rejects >= DISPLAY_WIDTH', () => {
    expect(validateDisplayX(576)).toBeInstanceOf(ValidationError);
    expect(validateDisplayX(999)).toBeInstanceOf(ValidationError);
  });

  it('rejects non-integer', () => {
    expect(validateDisplayX(1.5)).toBeInstanceOf(ValidationError);
    expect(validateDisplayX(NaN)).toBeInstanceOf(ValidationError);
  });
});

describe('validateDisplayY', () => {
  it('accepts valid values', () => {
    expect(validateDisplayY(0)).not.toBeInstanceOf(ValidationError);
    expect(validateDisplayY(287)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects >= DISPLAY_HEIGHT', () => {
    expect(validateDisplayY(288)).toBeInstanceOf(ValidationError);
  });
});

describe('validateDisplayW', () => {
  it('accepts valid values', () => {
    expect(validateDisplayW(1)).not.toBeInstanceOf(ValidationError);
    expect(validateDisplayW(576)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects zero and > DISPLAY_WIDTH', () => {
    expect(validateDisplayW(0)).toBeInstanceOf(ValidationError);
    expect(validateDisplayW(577)).toBeInstanceOf(ValidationError);
  });
});

describe('validateDisplayH', () => {
  it('accepts valid values', () => {
    expect(validateDisplayH(1)).not.toBeInstanceOf(ValidationError);
    expect(validateDisplayH(288)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects zero and > DISPLAY_HEIGHT', () => {
    expect(validateDisplayH(0)).toBeInstanceOf(ValidationError);
    expect(validateDisplayH(289)).toBeInstanceOf(ValidationError);
  });
});

describe('validateContainerID', () => {
  it('accepts positive integers', () => {
    expect(validateContainerID(1)).not.toBeInstanceOf(ValidationError);
    expect(validateContainerID(99)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects zero and negative', () => {
    expect(validateContainerID(0)).toBeInstanceOf(ValidationError);
    expect(validateContainerID(-1)).toBeInstanceOf(ValidationError);
  });
});

describe('assertDisplayX', () => {
  it('returns branded type for valid', () => {
    expect(assertDisplayX(42)).toBe(42);
  });

  it('throws RangeError for invalid', () => {
    expect(() => assertDisplayX(576)).toThrow(RangeError);
    expect(() => assertDisplayX(-1)).toThrow(RangeError);
  });
});

describe('assertDisplayY', () => {
  it('returns branded type for valid', () => {
    expect(assertDisplayY(42)).toBe(42);
  });

  it('throws RangeError for invalid', () => {
    expect(() => assertDisplayY(288)).toThrow(RangeError);
  });
});

describe('validateContainerRect', () => {
  it('accepts full-screen rect', () => {
    const r = validateContainerRect(0, 0, 576, 288);
    expect(r).not.toBeInstanceOf(ValidationError);
    if (!(r instanceof ValidationError)) {
      expect(r.x).toBe(0);
      expect(r.y).toBe(0);
      expect(r.w).toBe(576);
      expect(r.h).toBe(288);
    }
  });

  it('accepts small centered rect', () => {
    const r = validateContainerRect(100, 50, 200, 100);
    expect(r).not.toBeInstanceOf(ValidationError);
  });

  it('rejects x+w overflow', () => {
    expect(validateContainerRect(500, 0, 100, 100)).toBeInstanceOf(ValidationError);
  });

  it('rejects y+h overflow', () => {
    expect(validateContainerRect(0, 250, 100, 50)).toBeInstanceOf(ValidationError);
  });

  it('rejects out-of-bounds x', () => {
    expect(validateContainerRect(600, 0, 100, 100)).toBeInstanceOf(ValidationError);
  });
});

describe('validateUniqueContainerIDs', () => {
  it('returns empty for unique IDs', () => {
    expect(validateUniqueContainerIDs([1, 2, 3])).toEqual([]);
  });

  it('returns duplicates', () => {
    expect(validateUniqueContainerIDs([1, 2, 2, 3, 1])).toEqual([2, 1]);
  });

  it('returns empty for single ID', () => {
    expect(validateUniqueContainerIDs([1])).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(validateUniqueContainerIDs([])).toEqual([]);
  });
});

describe('validateContainerCount', () => {
  it('returns null for match', () => {
    expect(validateContainerCount(2, 2)).toBeNull();
  });

  it('returns ValidationError for mismatch', () => {
    expect(validateContainerCount(1, 2)).toBeInstanceOf(ValidationError);
    expect(validateContainerCount(3, 2)).toBeInstanceOf(ValidationError);
  });
});

describe('validateG2Pixels', () => {
  it('accepts valid pixel data', () => {
    const data = new Uint8Array(DISPLAY_PIXEL_COUNT);
    data.fill(0);
    expect(validateG2Pixels(data)).not.toBeInstanceOf(ValidationError);
  });

  it('accepts max 4-bit values', () => {
    const data = new Uint8Array(DISPLAY_PIXEL_COUNT);
    data.fill(15);
    expect(validateG2Pixels(data)).not.toBeInstanceOf(ValidationError);
  });

  it('rejects wrong length', () => {
    const data = new Uint8Array(100);
    expect(validateG2Pixels(data)).toBeInstanceOf(ValidationError);
  });

  it('rejects values > 15', () => {
    const data = new Uint8Array(DISPLAY_PIXEL_COUNT);
    data[0] = 16;
    expect(validateG2Pixels(data)).toBeInstanceOf(ValidationError);
  });
});

describe('assertG2Pixels', () => {
  it('returns branded type for valid', () => {
    const data = new Uint8Array(DISPLAY_PIXEL_COUNT);
    data.fill(0);
    expect(assertG2Pixels(data)).toBe(data);
  });

  it('throws RangeError for wrong length', () => {
    expect(() => assertG2Pixels(new Uint8Array(10))).toThrow(RangeError);
  });
});

describe('FULL_DISPLAY_RECT', () => {
  it('has correct dimensions', () => {
    expect(FULL_DISPLAY_RECT.x).toBe(0);
    expect(FULL_DISPLAY_RECT.y).toBe(0);
    expect(FULL_DISPLAY_RECT.w).toBe(DISPLAY_WIDTH);
    expect(FULL_DISPLAY_RECT.h).toBe(DISPLAY_HEIGHT);
  });
});

describe('ValidationError', () => {
  it('has correct name', () => {
    const err = new ValidationError('test');
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('test');
    expect(err).toBeInstanceOf(Error);
  });
});
