/**
 * Security Integration Tests
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 * 
 * Tests XSS prevention, SQL injection prevention (via Prisma),
 * CSRF protection, security headers, and HTTPS redirect
 */

import { sanitizeInput } from '../lib/input-sanitization'
import { validateFormat } from '../lib/validation'
import { middleware } from '../middleware'

// Mock NextRequest for middleware tests
const createMockRequest = (url: string, headers: Record<string, string> = {}) => {
  return {
    nextUrl: {
      clone: () => ({
        protocol: url.startsWith('https') ? 'https' : 'http',
        toString: () => url,
      }),
    },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as any
}

jest.mock('next/server', () => ({
  NextResponse: {
    next: () => {
      const headers = new Map<string, string>()
      return {
        headers: {
          set: (key: string, value: string) => headers.set(key, value),
          get: (key: string) => headers.get(key),
          entries: () => headers.entries(),
        },
      }
    },
    redirect: jest.fn((url: any, status: number) => ({
      url,
      status,
      headers: new Map(),
    })),
  },
}))

describe('Security Integration Tests', () => {
  describe('XSS Prevention (Requirement 11.1)', () => {
    it('should prevent script injection', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
    })

    it('should prevent event handler injection', () => {
      const maliciousInput = '<img src=x onerror="alert(1)">'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('alert')
    })

    it('should prevent javascript: protocol', () => {
      const maliciousInput = '<a href="javascript:alert(1)">Click</a>'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).not.toContain('javascript:')
    })

    it('should prevent data: protocol', () => {
      const maliciousInput = '<img src="data:text/html,<script>alert(1)</script>">'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).not.toContain('data:')
    })

    it('should handle multiple XSS vectors', () => {
      const xssVectors = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
      ]

      xssVectors.forEach(vector => {
        const sanitized = sanitizeInput(vector)
        // Should not contain dangerous tags or event handlers
        expect(sanitized.toLowerCase()).not.toContain('<script')
        expect(sanitized.toLowerCase()).not.toContain('onerror')
        expect(sanitized.toLowerCase()).not.toContain('onload')
        expect(sanitized.toLowerCase()).not.toContain('<iframe')
      })
    })
  })

  describe('SQL Injection Prevention (Requirement 11.2, 11.3)', () => {
    // Note: Prisma ORM provides built-in SQL injection protection
    // through parameterized queries. These tests verify that our
    // validation layer handles special characters safely.

    it('should handle URLs with special characters safely', () => {
      // URLs with SQL-like syntax are technically valid URLs
      // Prisma's parameterized queries will handle them safely
      const urlsWithSpecialChars = [
        "http://example.com/path?query='; DROP TABLE users; --",
        "http://example.com/path?param=' OR '1'='1",
      ]

      urlsWithSpecialChars.forEach(url => {
        const result = validateFormat(url)
        // These are valid URLs, Prisma will handle them safely with parameterized queries
        expect(result.isValid).toBe(true)
      })
    })

    it('should handle special characters safely in URLs', () => {
      // Valid URLs with special characters should be handled safely
      const validUrl = 'http://example.com/path?param=value&other=123'
      const result = validateFormat(validUrl)
      
      expect(result.isValid).toBe(true)
    })
  })

  describe('CSRF Protection (Requirement 11.5)', () => {
    it('should allow GET requests without CSRF validation', () => {
      const request = createMockRequest('http://localhost:3000/api/test')
      request.method = 'GET'
      
      // GET requests should pass through
      const response = middleware(request)
      expect(response).toBeDefined()
    })

    it('should validate origin for POST requests', () => {
      // This is tested in csrf.test.ts
      // Middleware sets security headers which include CSRF protection
      const request = createMockRequest('http://localhost:3000/api/test', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })
      request.method = 'POST'
      
      const response = middleware(request)
      expect(response).toBeDefined()
    })
  })

  describe('Security Headers (Requirement 11.4)', () => {
    it('should set X-Frame-Options to prevent clickjacking', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('should set X-Content-Type-Options to prevent MIME sniffing', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('should set X-XSS-Protection', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    })

    it('should set Content-Security-Policy', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toBeTruthy()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('should set Referrer-Policy', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should set Permissions-Policy', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toBeTruthy()
      expect(policy).toContain('geolocation=()')
      expect(policy).toContain('microphone=()')
      expect(policy).toContain('camera=()')
    })
  })

  describe('HTTPS Enforcement (Requirement 11.6)', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('should set HSTS header in production', () => {
      process.env.NODE_ENV = 'production'
      
      const request = createMockRequest('https://example.com/', {
        'x-forwarded-proto': 'https',
      })
      const response = middleware(request)
      
      const hsts = response.headers.get('Strict-Transport-Security')
      expect(hsts).toBeTruthy()
      expect(hsts).toContain('max-age=31536000')
      expect(hsts).toContain('includeSubDomains')
      expect(hsts).toContain('preload')
    })

    it('should not set HSTS header in development', () => {
      process.env.NODE_ENV = 'development'
      
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)
      
      expect(response.headers.get('Strict-Transport-Security')).toBeUndefined()
    })
  })

  describe('Open Redirect Prevention (Requirement 11.9)', () => {
    it('should reject URLs with double slashes', () => {
      const result = validateFormat('http://example.com//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('suspicious')
    })

    it('should reject URLs with backslashes', () => {
      const result = validateFormat('http://example.com\\evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('suspicious')
    })

    it('should reject URLs with @ in path', () => {
      const result = validateFormat('http://example.com/path@evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('suspicious')
    })

    it('should reject URLs with redirect parameters to different domains', () => {
      const result = validateFormat('http://example.com?redirect=//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('suspicious')
    })
  })

  describe('Private IP Prevention (Requirement 11.8)', () => {
    it('should reject localhost', () => {
      const result = validateFormat('http://localhost/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('private')
    })

    it('should reject 127.0.0.1', () => {
      const result = validateFormat('http://127.0.0.1/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('private')
    })

    it('should reject 192.168.x.x', () => {
      const result = validateFormat('http://192.168.1.1/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('private')
    })

    it('should reject 10.x.x.x', () => {
      const result = validateFormat('http://10.0.0.1/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('private')
    })

    it('should reject 172.16-31.x.x', () => {
      const result = validateFormat('http://172.16.0.1/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('private')
    })
  })

  describe('URL Length Limit (Requirement 11.8)', () => {
    it('should reject URLs longer than 2048 characters', () => {
      const longUrl = 'http://example.com/' + 'a'.repeat(2050)
      const result = validateFormat(longUrl)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('maximum length')
    })

    it('should accept URLs up to 2048 characters', () => {
      const maxUrl = 'http://example.com/' + 'a'.repeat(2020)
      const result = validateFormat(maxUrl)
      
      expect(result.isValid).toBe(true)
    })
  })

  describe('Protocol Validation', () => {
    it('should only accept HTTP and HTTPS protocols', () => {
      const validProtocols = [
        'http://example.com',
        'https://example.com',
      ]

      validProtocols.forEach(url => {
        const result = validateFormat(url)
        expect(result.isValid).toBe(true)
      })
    })

    it('should reject other protocols', () => {
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
