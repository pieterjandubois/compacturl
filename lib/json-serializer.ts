/**
 * JSON Serializer and Deserializer Utilities
 * Provides functions to serialize objects to JSON and deserialize JSON to objects
 * with proper error handling and validation
 */

export type SerializeResult =
  | { success: true; data: string }
  | { success: false; error: string }

export type DeserializeResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Serializes a value to JSON string
 * @param value - The value to serialize
 * @returns Result with JSON string or error
 */
export function serializeJson(value: any): SerializeResult {
  // Check for undefined
  if (value === undefined) {
    return {
      success: false,
      error: 'Cannot serialize undefined value',
    }
  }

  // Check for functions
  if (typeof value === 'function') {
    return {
      success: false,
      error: 'Cannot serialize function',
    }
  }

  // Check for symbols
  if (typeof value === 'symbol') {
    return {
      success: false,
      error: 'Cannot serialize symbol',
    }
  }

  try {
    const json = JSON.stringify(value)
    return {
      success: true,
      data: json,
    }
  } catch (error) {
    // Handle circular references and other serialization errors
    if (error instanceof Error) {
      if (error.message.includes('circular')) {
        return {
          success: false,
          error: 'Cannot serialize object with circular references',
        }
      }
      return {
        success: false,
        error: `Serialization failed: ${error.message}`,
      }
    }
    return {
      success: false,
      error: 'Serialization failed: Unknown error',
    }
  }
}

/**
 * Deserializes a JSON string to a value
 * @param json - The JSON string to deserialize
 * @returns Result with deserialized value or error
 */
export function deserializeJson<T = any>(json: string): DeserializeResult<T> {
  // Check if input is a string
  if (typeof json !== 'string') {
    return {
      success: false,
      error: 'Invalid input: JSON must be a string',
    }
  }

  // Check for empty string
  if (json.trim() === '') {
    return {
      success: false,
      error: 'Invalid JSON: Cannot deserialize empty string',
    }
  }

  try {
    const value = JSON.parse(json)
    return {
      success: true,
      data: value,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
      }
    }
    return {
      success: false,
      error: 'Invalid JSON: Unable to parse',
    }
  }
}
