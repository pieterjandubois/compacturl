/**
 * Unit Tests for CSRF Protection
 * Requirement: 11.5
 */

import { verifyCsrfProtection, getCsrfTokenName, checkCsrf } from '../csrf'

// Mock NextRequest
const createMockRequest = (method: string, headers: Record<string, string> = {}) => {
  return {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as any
}

// Mock getServerSession
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

import { getServerSession } from 'next-auth'

describe('CSRF Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('verifyCsrfProtection', () => {
    it('should allow GET requests without CSRF check', async () => {
      const request = createMockRequest('GET')

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should validate POST requests with matching origin', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should reject POST requests with mismatched origin', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('POST', {
        origin: 'http://evil.com',
        host: 'localhost:3000',
      })

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(false)
    })

    it('should allow authenticated requests (NextAuth validates CSRF)', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: '123', email: 'test@example.com' },
      })

      const request = createMockRequest('POST')

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should validate PUT requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('PUT', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should validate PATCH requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('PATCH', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should validate DELETE requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('DELETE', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })

    it('should allow requests without origin header', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('POST')

      const result = await verifyCsrfProtection(request)
      expect(result).toBe(true)
    })
  })

  describe('getCsrfTokenName', () => {
    it('should return correct token name for development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const tokenName = getCsrfTokenName()
      expect(tokenName).toBe('next-auth.csrf-token')

      process.env.NODE_ENV = originalEnv
    })

    it('should return correct token name for production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const tokenName = getCsrfTokenName()
      expect(tokenName).toBe('__Host-next-auth.csrf-token')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('checkCsrf', () => {
    it('should return safe=true for valid requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })

      const result = await checkCsrf(request)
      expect(result.safe).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return safe=false with error for invalid requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = createMockRequest('POST', {
        origin: 'http://evil.com',
        host: 'localhost:3000',
      })

      const result = await checkCsrf(request)
      expect(result.safe).toBe(false)
      expect(result.error).toBe('CSRF validation failed')
    })
  })
})
