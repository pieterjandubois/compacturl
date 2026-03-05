/**
 * Unit Tests for Security Headers Middleware
 * Requirements: 11.4, 11.5, 11.6
 */

import { middleware } from '../middleware'

// Mock NextResponse
const mockNextResponse = {
  next: jest.fn(() => ({
    headers: new Map(),
    set: jest.fn(),
  })),
  redirect: jest.fn(),
}

// Mock NextRequest
const createMockRequest = (url: string, headers: Record<string, string> = {}) => {
  return {
    nextUrl: {
      clone: () => ({
        protocol: 'http',
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
    })),
  },
}))

describe('Security Headers Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Security Headers', () => {
    it('should set X-Frame-Options header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('should set X-Content-Type-Options header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('should set X-XSS-Protection header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    })

    it('should set Referrer-Policy header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should set Content-Security-Policy header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("base-uri 'self'")
    })

    it('should set Permissions-Policy header', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toContain('geolocation=()')
      expect(policy).toContain('microphone=()')
      expect(policy).toContain('camera=()')
    })

    it('should set all security headers on every request', () => {
      const request = createMockRequest('http://localhost:3000/api/test')
      const response = middleware(request)

      const headers = Array.from(response.headers.entries())
      const headerNames = headers.map(([name]) => name)

      expect(headerNames).toContain('X-Frame-Options')
      expect(headerNames).toContain('X-Content-Type-Options')
      expect(headerNames).toContain('X-XSS-Protection')
      expect(headerNames).toContain('Referrer-Policy')
      expect(headerNames).toContain('Content-Security-Policy')
      expect(headerNames).toContain('Permissions-Policy')
    })
  })

  describe('HTTPS Enforcement', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('should set Strict-Transport-Security header in production', () => {
      process.env.NODE_ENV = 'production'

      const request = createMockRequest('https://example.com/', {
        'x-forwarded-proto': 'https',
      })
      const response = middleware(request)

      expect(response.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      )
    })

    it('should not set Strict-Transport-Security header in development', () => {
      process.env.NODE_ENV = 'development'

      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      expect(response.headers.get('Strict-Transport-Security')).toBeUndefined()
    })
  })

  describe('CSP Directives', () => {
    it('should allow self for default sources', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain("default-src 'self'")
    })

    it('should allow unsafe-inline for styles (Tailwind requirement)', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    })

    it('should allow data: and https: for images', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain('img-src')
      expect(csp).toContain('data:')
      expect(csp).toContain('https:')
    })

    it('should prevent framing with frame-ancestors none', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('should restrict form actions to self', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain("form-action 'self'")
    })
  })

  describe('Permissions Policy', () => {
    it('should disable geolocation', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toContain('geolocation=()')
    })

    it('should disable microphone', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toContain('microphone=()')
    })

    it('should disable camera', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toContain('camera=()')
    })

    it('should disable payment', () => {
      const request = createMockRequest('http://localhost:3000/')
      const response = middleware(request)

      const policy = response.headers.get('Permissions-Policy')
      expect(policy).toContain('payment=()')
    })
  })
})
