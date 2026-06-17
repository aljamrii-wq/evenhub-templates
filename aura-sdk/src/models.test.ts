/**
 * Tests for type-safe model wrappers (models.ts).
 *
 * Verifies:
 *   1. fromJson functions reject null, numbers, strings, arrays at runtime
 *   2. fromJson functions accept valid JSON objects
 *   3. TypeScript compile-time checks: JsonObject rejects non-object types
 */

import {
  fromJson_CreateStartUpPageContainer,
  fromJson_TextContainerProperty,
  fromJson_ImageContainerProperty,
  fromJson_TextContainerUpgrade,
  fromJson_ImageRawDataUpdate,
} from './models';

import type { JsonObject } from './types';

// ---------------------------------------------------------------------------
// Compile-time type check (verified by tsc, not at runtime)
// ---------------------------------------------------------------------------

// Static assertion helper — removed at runtime by tree-shaking
function assertAccepts<T>(_val: T): void {}
function assertRejects(_val: never): void {}

// These COMPILE-TIME checks verify that JsonObject rejects non-object types:
function compileTimeChecks() {
  const validJson: JsonObject = { key: 'value' };

  // @ts-expect-error — null is not assignable to JsonObject
  assertAccepts<JsonObject>(null);

  // @ts-expect-error — number is not assignable to JsonObject
  assertAccepts<JsonObject>(42);

  // @ts-expect-error — string is not assignable to JsonObject
  assertAccepts<JsonObject>('hello');

  // @ts-expect-error — array is not assignable to JsonObject
  assertAccepts<JsonObject>([1, 2, 3]);

  // @ts-expect-error — boolean is not assignable to JsonObject
  assertAccepts<JsonObject>(true);

  // Valid: object is assignable
  assertAccepts<JsonObject>(validJson);
}

// Suppress unused warning
void compileTimeChecks;

// ---------------------------------------------------------------------------
// Runtime tests
// ---------------------------------------------------------------------------

describe('models — type-safe fromJson wrappers', () => {
  const wrappers = [
    { name: 'CreateStartUpPageContainer', fn: fromJson_CreateStartUpPageContainer },
    { name: 'TextContainerProperty', fn: fromJson_TextContainerProperty },
    { name: 'ImageContainerProperty', fn: fromJson_ImageContainerProperty },
    { name: 'TextContainerUpgrade', fn: fromJson_TextContainerUpgrade },
    { name: 'ImageRawDataUpdate', fn: fromJson_ImageRawDataUpdate },
  ];

  describe('rejects non-object inputs at runtime', () => {
    const invalidInputs: Array<[string, unknown]> = [
      ['null', null],
      ['number (42)', 42],
      ['number (0)', 0],
      ['string ("hello")', 'hello'],
      ['string (empty)', ''],
      ['array', [1, 2, 3]],
      ['boolean (true)', true],
      ['boolean (false)', false],
      ['undefined', undefined],
    ];

    for (const wrapper of wrappers) {
      for (const [label, input] of invalidInputs) {
        it(`${wrapper.name}: throws on ${label}`, () => {
          expect(() => (wrapper.fn as (json: JsonObject) => unknown)(input as JsonObject)).toThrow(TypeError);
        });
      }
    }
  });

  describe('accepts valid JSON objects', () => {
    const validInputs: JsonObject[] = [
      {},
      { containerID: 1, containerName: 'test' },
      { xPosition: 0, yPosition: 0, width: 576, height: 288 },
    ];

    for (const wrapper of wrappers) {
      for (const input of validInputs) {
        it(`${wrapper.name}: accepts ${JSON.stringify(input)}`, () => {
          const result = (wrapper.fn as (json: JsonObject) => unknown)(input);
          expect(result).toBeDefined();
        });
      }
    }
  });

  describe('error messages include model name', () => {
    it('CreateStartUpPageContainer error mentions model name', () => {
      expect(() => fromJson_CreateStartUpPageContainer(null as unknown as JsonObject))
        .toThrow('CreateStartUpPageContainer');
    });

    it('TextContainerProperty error mentions model name', () => {
      expect(() => fromJson_TextContainerProperty(42 as unknown as JsonObject))
        .toThrow('TextContainerProperty');
    });
  });
});
