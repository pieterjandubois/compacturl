/**
 * Unit tests for JSON serializer utilities
 */

import { serializeJson, deserializeJson } from '../json-serializer'

describe('serializeJson', () => {
  it('should serialize a simple object to JSON string', () => {
    const obj = { name: 'John', age: 30 }
    const result = serializeJson(obj)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('{"name":"John","age":30}')
    }
  })

  it('should serialize an array to JSON string', () => {
    const arr = [1, 2, 3]
    const result = serializeJson(arr)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('[1,2,3]')
    }
  })

  it('should serialize nested objects', () => {
    const obj = { user: { name: 'John', address: { city: 'NYC' } } }
    const result = serializeJson(obj)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('{"user":{"name":"John","address":{"city":"NYC"}}}')
    }
  })

  it('should serialize null', () => {
    const result = serializeJson(null)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('null')
    }
  })

  it('should serialize boolean values', () => {
    const result1 = serializeJson(true)
    const result2 = serializeJson(false)

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    if (result1.success && result2.success) {
      expect(result1.data).toBe('true')
      expect(result2.data).toBe('false')
    }
  })

  it('should serialize numbers', () => {
    const result = serializeJson(42)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('42')
    }
  })

  it('should serialize strings', () => {
    const result = serializeJson('hello')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('"hello"')
    }
  })

  it('should handle objects with special characters', () => {
    const obj = { message: 'Hello "World"\nNew line' }
    const result = serializeJson(obj)

    expect(result.success).toBe(true)
    if (result.success) {
      const parsed = JSON.parse(result.data)
      expect(parsed.message).toBe('Hello "World"\nNew line')
    }
  })

  it('should fail for circular references', () => {
    const obj: any = { name: 'John' }
    obj.self = obj // Create circular reference

    const result = serializeJson(obj)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('circular')
    }
  })

  it('should fail for undefined', () => {
    const result = serializeJson(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('undefined')
    }
  })

  it('should fail for functions', () => {
    const result = serializeJson(() => {})

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('function')
    }
  })

  it('should fail for symbols', () => {
    const result = serializeJson(Symbol('test'))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('symbol')
    }
  })
})

describe('deserializeJson', () => {
  it('should deserialize a valid JSON string to object', () => {
    const json = '{"name":"John","age":30}'
    const result = deserializeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'John', age: 30 })
    }
  })

  it('should deserialize an array', () => {
    const json = '[1,2,3]'
    const result = deserializeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3])
    }
  })

  it('should deserialize nested objects', () => {
    const json = '{"user":{"name":"John","address":{"city":"NYC"}}}'
    const result = deserializeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        user: { name: 'John', address: { city: 'NYC' } },
      })
    }
  })

  it('should deserialize null', () => {
    const json = 'null'
    const result = deserializeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBeNull()
    }
  })

  it('should deserialize boolean values', () => {
    const result1 = deserializeJson('true')
    const result2 = deserializeJson('false')

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    if (result1.success && result2.success) {
      expect(result1.data).toBe(true)
      expect(result2.data).toBe(false)
    }
  })

  it('should deserialize numbers', () => {
    const result = deserializeJson('42')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(42)
    }
  })

  it('should deserialize strings', () => {
    const result = deserializeJson('"hello"')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('hello')
    }
  })

  it('should handle escaped characters', () => {
    const json = '{"message":"Hello \\"World\\"\\nNew line"}'
    const result = deserializeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ message: 'Hello "World"\nNew line' })
    }
  })

  it('should fail for invalid JSON syntax', () => {
    const json = '{"name": "John"'
    const result = deserializeJson(json)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON')
    }
  })

  it('should fail for empty string', () => {
    const result = deserializeJson('')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('empty')
    }
  })

  it('should fail for non-string input', () => {
    const result = deserializeJson(123 as any)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('string')
    }
  })

  it('should fail for malformed JSON', () => {
    const json = '{name: "John"}'
    const result = deserializeJson(json)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON')
    }
  })

  it('should fail for trailing commas', () => {
    const json = '{"name": "John",}'
    const result = deserializeJson(json)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON')
    }
  })
})

describe('JSON round-trip property', () => {
  it('should maintain data integrity through serialize-deserialize cycle', () => {
    const testCases = [
      { name: 'John', age: 30 },
      [1, 2, 3, 4, 5],
      { nested: { deep: { value: 'test' } } },
      null,
      true,
      false,
      42,
      'hello world',
      { array: [1, 2, { nested: true }] },
    ]

    testCases.forEach((testCase) => {
      const serialized = serializeJson(testCase)
      expect(serialized.success).toBe(true)

      if (serialized.success) {
        const deserialized = deserializeJson(serialized.data)
        expect(deserialized.success).toBe(true)

        if (deserialized.success) {
          expect(deserialized.data).toEqual(testCase)
        }
      }
    })
  })
})
