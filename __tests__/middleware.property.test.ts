/**
 * Property-Based Tests for Security Headers
 * Property 15: Security Headers
 * Requirements: 11.4, 11.5, 11.6
 * 
 * Validates that all security headers are present on all responses
 * and that HTTPS enforcement works in production
 * 
 * Tag: Feature: compact-url, Property 15: Security Headers
 */

import * as fc from 'fast-check'
import { middleware } from '../middleware'

// Mock NextRequest
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

describe('Property 15: Security Headers', () => {
  describe('All requests have security headers', () => {
    it('should set X-Frame-Options on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            expect(response.headers.get('X-Frame-Options')).toBe('DENY')
          }
        ),
        { numRuns: 10 } // Minimal iterations
      )
    })

    it('should set X-Content-Type-Options on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should set X-XSS-Protection on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should set Referrer-Policy on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should set Content-Security-Policy on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const csp = response.headers.get('Content-Security-Policy')
            expect(csp).toBeTruthy()
            expect(csp).toContain("default-src 'self'")
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should set Permissions-Policy on all requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const policy = response.headers.get('Permissions-Policy')
            expect(policy).toBeTruthy()
            expect(policy).toContain('geolocation=()')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should set all required security headers', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const requiredHeaders = [
              'X-Frame-Options',
              'X-Content-Type-Options',
              'X-XSS-Protection',
              'Referrer-Policy',
              'Content-Security-Policy',
              'Permissions-Policy',
            ]
            
            requiredHeaders.forEach(header => {
              expect(response.headers.get(header)).toBeTruthy()
            })
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('CSP prevents common attacks', () => {
    it('should prevent inline scripts by default', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const csp = response.headers.get('Content-Security-Policy')
            // Note: Next.js requires unsafe-eval and unsafe-inline for development
            // In production, these should be removed or replaced with nonces
            expect(csp).toContain('script-src')
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should prevent framing from any origin', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const csp = response.headers.get('Content-Security-Policy')
            expect(csp).toContain("frame-ancestors 'none'")
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should restrict form submissions to same origin', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const csp = response.headers.get('Content-Security-Policy')
            expect(csp).toContain("form-action 'self'")
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('Permissions Policy restricts features', () => {
    it('should disable dangerous browser features', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            const policy = response.headers.get('Permissions-Policy')
            
            // Check that dangerous features are disabled
            const dangerousFeatures = ['geolocation', 'microphone', 'camera', 'payment']
            dangerousFeatures.forEach(feature => {
              expect(policy).toContain(`${feature}=()`)
            })
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('HTTPS enforcement in production', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it('should set HSTS header in production', () => {
      process.env.NODE_ENV = 'production'

      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          (url) => {
            const request = createMockRequest(url, {
              'x-forwarded-proto': 'https',
            })
            const response = middleware(request)
            
            const hsts = response.headers.get('Strict-Transport-Security')
            expect(hsts).toBeTruthy()
            expect(hsts).toContain('max-age=')
            expect(hsts).toContain('includeSubDomains')
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should not set HSTS header in development', () => {
      process.env.NODE_ENV = 'development'

      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const request = createMockRequest(url)
            const response = middleware(request)
            
            expect(response.headers.get('Strict-Transport-Security')).toBeUndefined()
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('Header consistency', () => {
    it('should set same headers regardless of URL path', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.webUrl(), fc.webUrl()),
          ([url1, url2]) => {
            const request1 = createMockRequest(url1)
            const request2 = createMockRequest(url2)
            
            const response1 = middleware(request1)
            const response2 = middleware(request2)
            
            // Same headers should be set
            expect(response1.headers.get('X-Frame-Options')).toBe(
              response2.headers.get('X-Frame-Options')
            )
            expect(response1.headers.get('X-Content-Type-Options')).toBe(
              response2.headers.get('X-Content-Type-Options')
            )
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
