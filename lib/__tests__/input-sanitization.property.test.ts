/**
 * Property-Based Tests for Input Sanitization
 * Property 10: Input Sanitization Safety
 * Requirements: 11.1, 11.2, 11.7, 11.8, 11.9
 * 
 * Validates that sanitized input contains no executable code
 * and that URL validation rejects malicious inputs
 * 
 * Tag: Feature: compact-url, Property 10: Input Sanitization Safety
 */

import * as fc from 'fast-check'
import { sanitizeInput, validateShortCode, validateEmail, validatePassword } from '../input-sanitization'
import { validateFormat } from '../validation'

describe('Property 10: Input Sanitization Safety', () => {
  describe('sanitizeInput properties', () => {
    it('should never contain script tags after sanitization', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizeInput(input)
            // Should not contain script tags
            expect(sanitized.toLowerCase()).not.toContain('<script')
            expect(sanitized.toLowerCase()).not.toContain('</script>')
          }
        ),
        { numRuns: 10 } // Minimal iterations for fast operation
      )
    })

    it('should never contain event handlers after sanitization', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizeInput(input)
            // Should not contain common event handlers
            const eventHandlers = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus']
            eventHandlers.forEach(handler => {
              expect(sanitized.toLowerCase()).not.toContain(handler + '=')
            })
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should never contain javascript: protocol after sanitization', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizeInput(input)
            expect(sanitized.toLowerCase()).not.toContain('javascript:')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should never contain data: protocol after sanitization', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizeInput(input)
            expect(sanitized.toLowerCase()).not.toContain('data:')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should be idempotent (sanitizing twice gives same result)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized1 = sanitizeInput(input)
            const sanitized2 = sanitizeInput(sanitized1)
            expect(sanitized2).toBe(sanitized1)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle XSS payloads safely', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<select onfocus=alert(1) autofocus>',
        '<textarea onfocus=alert(1) autofocus>',
        '<keygen onfocus=alert(1) autofocus>',
        '<video><source onerror="alert(1)">',
        '<audio src=x onerror=alert(1)>',
        '<details open ontoggle=alert(1)>',
        '<marquee onstart=alert(1)>',
      ]

      xssPayloads.forEach(payload => {
        const sanitized = sanitizeInput(payload)
        
        // Should not contain dangerous patterns
        expect(sanitized.toLowerCase()).not.toContain('<script')
        expect(sanitized.toLowerCase()).not.toContain('javascript:')
        expect(sanitized.toLowerCase()).not.toContain('onerror')
        expect(sanitized.toLowerCase()).not.toContain('onload')
        expect(sanitized.toLowerCase()).not.toContain('onfocus')
        expect(sanitized.toLowerCase()).not.toContain('<iframe')
      })
    })
  })

  describe('validateShortCode properties', () => {
    it('should only accept lowercase alphanumeric with hyphens', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-'), { minLength: 1, maxLength: 20 }),
          (shortCode) => {
            // If it matches the pattern, it should be valid
            if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(shortCode)) {
              expect(validateShortCode(shortCode)).toBe(true)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reject uppercase letters', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => /[A-Z]/.test(s)),
          (shortCode) => {
            expect(validateShortCode(shortCode)).toBe(false)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reject special characters except hyphens', () => {
      const specialChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '=', '[', ']', '{', '}', '|', '\\', '/', '?', '.', ',', '<', '>', '~', '`', ' ']
      
      specialChars.forEach(char => {
        expect(validateShortCode(`test${char}link`)).toBe(false)
      })
    })
  })

  describe('validateEmail properties', () => {
    it('should accept valid email format', () => {
      // Generate emails with alphanumeric start
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3'), { minLength: 1, maxLength: 10 }),
            fc.constantFrom('@'),
            fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3'), { minLength: 1, maxLength: 10 }),
            fc.constantFrom('.'),
            fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 2, maxLength: 5 })
          ),
          ([local, at, domain, dot, tld]) => {
            const email = local + at + domain + dot + tld
            if (email.length <= 255) {
              expect(validateEmail(email)).toBe(true)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reject emails without @ symbol', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('@')),
          (email) => {
            expect(validateEmail(email)).toBe(false)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reject emails longer than 255 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 256 }),
          (email) => {
            expect(validateEmail(email)).toBe(false)
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('validatePassword properties', () => {
    it('should reject passwords shorter than 12 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 11 }),
          (password) => {
            const result = validatePassword(password)
            expect(result.isValid).toBe(false)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should require all character types for valid password', () => {
      // Generate password with all requirements
      fc.assert(
        fc.property(
          fc.tuple(
            fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E'), { minLength: 1, maxLength: 3 }),
            fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 3 }),
            fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4'), { minLength: 1, maxLength: 3 }),
            fc.stringOf(fc.constantFrom('!', '@', '#', '$', '%'), { minLength: 1, maxLength: 3 }),
            fc.string({ minLength: 0, maxLength: 5 })
          ),
          ([upper, lower, digit, special, extra]) => {
            const password = upper + lower + digit + special + extra
            if (password.length >= 12) {
              const result = validatePassword(password)
              expect(result.isValid).toBe(true)
            }
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('URL validation rejects malicious inputs', () => {
    it('should reject localhost and private IPs', () => {
      const maliciousUrls = [
        'http://localhost/path',
        'http://127.0.0.1/path',
        'http://192.168.1.1/path',
        'http://10.0.0.1/path',
        'http://172.16.0.1/path',
      ]

      maliciousUrls.forEach(url => {
        const result = validateFormat(url)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('private')
      })
    })

    it('should reject open redirect patterns', () => {
      const openRedirectUrls = [
        'http://example.com//evil.com',
        'http://example.com\\evil.com',
        'http://example.com/path@evil.com',
        'http://example.com?redirect=//evil.com',
        'http://example.com?url=http://evil.com',
      ]

      openRedirectUrls.forEach(url => {
        const result = validateFormat(url)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('suspicious')
      })
    })

    it('should reject URLs longer than 2048 characters', () => {
      const longUrl = 'http://example.com/' + 'a'.repeat(2050)
      const result = validateFormat(longUrl)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('maximum length')
    })

    it('should reject non-HTTP(S) protocols', () => {
      const invalidProtocols = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ]

      invalidProtocols.forEach(url => {
        const result = validateFormat(url)
        expect(result.isValid).toBe(false)
      })
    })
  })
})
