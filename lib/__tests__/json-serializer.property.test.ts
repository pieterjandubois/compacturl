/**
 * Property-based tests for JSON serializer utilities
 * **Validates: Requirements 15.6, 15.7**
 */

import * as fc from 'fast-check'
import { serializeJson, deserializeJson } from '../json-serializer'

describe('JSON Serializer Properties', () => {
  /**
   * Property: JSON Round-Trip Consistency
   * FOR ALL valid JSON objects, serialization then deserialization SHALL produce an equivalent object
   * Validates: Requirement 15.8 (round-trip property)
   */
  it('should maintain data integrity through serialize-deserialize cycle', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            name: fc.string(),
            age: fc.integer(),
          }),
          fc.array(fc.integer()),
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null)
        ),
        (value) => {
          const serialized = serializeJson(value)
          expect(serialized.success).toBe(true)

          if (serialized.success) {
            const deserialized = deserializeJson(serialized.data)
            expect(deserialized.success).toBe(true)

            if (deserialized.success) {
              expect(deserialized.data).toEqual(value)
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Serialization Determinism
   * FOR ALL valid objects, serializing the same object multiple times SHALL produce the same result
   */
  it('should produce consistent serialization for the same input', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer(),
          name: fc.string(),
          active: fc.boolean(),
        }),
        (obj) => {
          const result1 = serializeJson(obj)
          const result2 = serializeJson(obj)

          expect(result1.success).toBe(true)
          expect(result2.success).toBe(true)

          if (result1.success && result2.success) {
            expect(result1.data).toBe(result2.data)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Deserialization Idempotence
   * FOR ALL valid JSON strings, deserializing the same string multiple times SHALL produce the same result
   */
  it('should produce consistent deserialization for the same input', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const json = JSON.stringify(value)

        const result1 = deserializeJson(json)
        const result2 = deserializeJson(json)

        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)

        if (result1.success && result2.success) {
          expect(result1.data).toEqual(result2.data)
        }
      }),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Invalid Input Rejection
   * FOR ALL invalid inputs, serialization SHALL fail gracefully with error message
   */
  it('should reject invalid serialization inputs with descriptive errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(undefined), fc.func(fc.anything()), fc.constant(Symbol('test'))),
        (invalidValue) => {
          const result = serializeJson(invalidValue)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeTruthy()
            expect(typeof result.error).toBe('string')
            expect(result.error.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Malformed JSON Rejection
   * FOR ALL malformed JSON strings, deserialization SHALL fail gracefully with error message
   */
  it('should reject malformed JSON with descriptive errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('{invalid}'),
          fc.constant('{"key": }'),
          fc.constant('{"key": "value",}'),
          fc.constant('[1, 2, 3,]')
        ),
        (malformedJson) => {
          const result = deserializeJson(malformedJson)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeTruthy()
            expect(typeof result.error).toBe('string')
            expect(result.error.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Type Preservation
   * FOR ALL valid JSON values, the type SHALL be preserved through round-trip
   */
  it('should preserve data types through round-trip', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        (value) => {
          const serialized = serializeJson(value)
          expect(serialized.success).toBe(true)

          if (serialized.success) {
            const deserialized = deserializeJson(serialized.data)
            expect(deserialized.success).toBe(true)

            if (deserialized.success) {
              expect(typeof deserialized.data).toBe(typeof value)
              expect(deserialized.data).toEqual(value)
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Nested Structure Preservation
   * FOR ALL nested objects, structure SHALL be preserved through round-trip
   */
  it('should preserve nested structure through round-trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          user: fc.record({
            name: fc.string(),
            profile: fc.record({
              age: fc.integer(),
              active: fc.boolean(),
            }),
          }),
        }),
        (nestedObj) => {
          const serialized = serializeJson(nestedObj)
          expect(serialized.success).toBe(true)

          if (serialized.success) {
            const deserialized = deserializeJson(serialized.data)
            expect(deserialized.success).toBe(true)

            if (deserialized.success) {
              expect(deserialized.data).toEqual(nestedObj)
              // Verify nested structure
              expect(deserialized.data).toHaveProperty('user')
              expect(deserialized.data).toHaveProperty('user.profile')
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Array Preservation
   * FOR ALL arrays, order and content SHALL be preserved through round-trip
   */
  it('should preserve array order and content through round-trip', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.integer(), fc.string(), fc.boolean())),
        (arr) => {
          const serialized = serializeJson(arr)
          expect(serialized.success).toBe(true)

          if (serialized.success) {
            const deserialized = deserializeJson(serialized.data)
            expect(deserialized.success).toBe(true)

            if (deserialized.success) {
              expect(Array.isArray(deserialized.data)).toBe(true)
              expect(deserialized.data).toEqual(arr)
              expect(deserialized.data).toHaveLength(arr.length)
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})
