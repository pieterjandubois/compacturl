/**
 * Unit Tests for Input Sanitization Utilities
 * Requirements: 11.1, 11.2, 11.7
 * 
 * Tests XSS prevention, input validation, and sanitization
 */

import {
  sanitizeInput,
  validateShortCode,
  validateEmail,
  validatePassword,
} from '../input-sanitization'

describe('Input Sanitization Utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello'
      const result = sanitizeInput(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
      expect(result).toContain('Hello')
    })

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>'
      const result = sanitizeInput(input)
      expect(result).not.toContain('onclick')
      expect(result).toContain('Click me')
    })

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Link</a>'
      const result = sanitizeInput(input)
      expect(result).not.toContain('javascript:')
      expect(result).toContain('Link')
    })

    it('should remove data: protocol', () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">'
      const result = sanitizeInput(input)
      expect(result).not.toContain('data:')
    })

    it('should handle encoded script tags', () => {
      const input = '&lt;script&gt;alert(1)&lt;/script&gt;'
      const result = sanitizeInput(input)
      expect(result).not.toContain('script')
    })

    it('should preserve safe HTML entities', () => {
      const input = 'Hello &amp; goodbye'
      const result = sanitizeInput(input)
      expect(result).toContain('&')
    })

    it('should handle empty string', () => {
      const result = sanitizeInput('')
      expect(result).toBe('')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null as any)).toBe('')
      expect(sanitizeInput(undefined as any)).toBe('')
    })

    it('should remove style tags', () => {
      const input = '<style>body { display: none; }</style>Text'
      const result = sanitizeInput(input)
      expect(result).not.toContain('<style>')
      expect(result).toContain('Text')
    })

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>Content'
      const result = sanitizeInput(input)
      expect(result).not.toContain('<iframe>')
      expect(result).toContain('Content')
    })
  })

  describe('validateShortCode', () => {
    it('should accept valid short codes', () => {
      expect(validateShortCode('example')).toBe(true)
      expect(validateShortCode('my-link')).toBe(true)
      expect(validateShortCode('test123')).toBe(true)
      expect(validateShortCode('a')).toBe(true)
      expect(validateShortCode('abc-123-xyz')).toBe(true)
    })

    it('should reject short codes with uppercase letters', () => {
      expect(validateShortCode('Example')).toBe(false)
      expect(validateShortCode('TEST')).toBe(false)
    })

    it('should reject short codes with special characters', () => {
      expect(validateShortCode('test@link')).toBe(false)
      expect(validateShortCode('my_link')).toBe(false)
      expect(validateShortCode('test.com')).toBe(false)
      expect(validateShortCode('link/path')).toBe(false)
      expect(validateShortCode('test link')).toBe(false)
    })

    it('should reject empty short codes', () => {
      expect(validateShortCode('')).toBe(false)
    })

    it('should reject null and undefined', () => {
      expect(validateShortCode(null as any)).toBe(false)
      expect(validateShortCode(undefined as any)).toBe(false)
    })

    it('should reject short codes starting or ending with hyphen', () => {
      expect(validateShortCode('-test')).toBe(false)
      expect(validateShortCode('test-')).toBe(false)
      expect(validateShortCode('-')).toBe(false)
    })

    it('should reject short codes with consecutive hyphens', () => {
      expect(validateShortCode('test--link')).toBe(false)
    })
  })

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true)
      expect(validateEmail('test.user@example.co.uk')).toBe(true)
      expect(validateEmail('user+tag@example.com')).toBe(true)
      expect(validateEmail('user123@test-domain.com')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('invalid@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('user @example.com')).toBe(false)
    })

    it('should reject emails without domain', () => {
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('user@.')).toBe(false)
    })

    it('should reject emails without local part', () => {
      expect(validateEmail('@example.com')).toBe(false)
    })

    it('should reject empty emails', () => {
      expect(validateEmail('')).toBe(false)
    })

    it('should reject null and undefined', () => {
      expect(validateEmail(null as any)).toBe(false)
      expect(validateEmail(undefined as any)).toBe(false)
    })

    it('should reject emails longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(validateEmail(longEmail)).toBe(false)
    })

    it('should reject emails with multiple @ symbols', () => {
      expect(validateEmail('user@@example.com')).toBe(false)
      expect(validateEmail('user@test@example.com')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('MyPassword123!')).toEqual({ isValid: true })
      expect(validatePassword('Secure@Pass1')).toEqual({ isValid: true })
      expect(validatePassword('Test1234!@#$')).toEqual({ isValid: true })
    })

    it('should reject passwords shorter than 12 characters', () => {
      const result = validatePassword('Short1!')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('12 characters')
    })

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('lowercase123!')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('uppercase')
    })

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('lowercase')
    })

    it('should reject passwords without numbers', () => {
      const result = validatePassword('NoNumbers!@#')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('number')
    })

    it('should reject passwords without special characters', () => {
      const result = validatePassword('NoSpecial123')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('special character')
    })

    it('should reject empty passwords', () => {
      const result = validatePassword('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('12 characters')
    })

    it('should reject null and undefined', () => {
      const resultNull = validatePassword(null as any)
      expect(resultNull.isValid).toBe(false)
      
      const resultUndefined = validatePassword(undefined as any)
      expect(resultUndefined.isValid).toBe(false)
    })

    it('should provide specific error messages for each requirement', () => {
      expect(validatePassword('short').error).toContain('12 characters')
      expect(validatePassword('nouppercase123!').error).toContain('uppercase')
      expect(validatePassword('NOLOWERCASE123!').error).toContain('lowercase')
      expect(validatePassword('NoNumbers!@#').error).toContain('number')
      expect(validatePassword('NoSpecial123').error).toContain('special character')
    })

    it('should accept passwords with exactly 12 characters', () => {
      expect(validatePassword('MyPass123!@#')).toEqual({ isValid: true })
    })

    it('should accept passwords with various special characters', () => {
      expect(validatePassword('Test1234!@#$%^&*()')).toEqual({ isValid: true })
      expect(validatePassword('Test1234-_=+[]{}|')).toEqual({ isValid: true })
    })
  })
})
