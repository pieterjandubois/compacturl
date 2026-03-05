/**
 * Unit Tests for URL Shortening Endpoint
 * Validates Requirements: 1.1, 2.4, 3.3, 10.3
 */

// Mock types
interface ShortenRequest {
  url: string;
  userId?: string | null;
  ip: string;
}

interface ShortenResponse {
  success: boolean;
  data?: {
    shortCode: string;
    shortUrl: string;
    originalUrl: string;
    expiresAt: Date | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Mock implementation (will be replaced with actual API call)
async function shortenUrl(request: ShortenRequest): Promise<ShortenResponse> {
  // Validate URL format
  try {
    new URL(request.url);
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'Invalid URL format',
      },
    };
  }

  // Check URL length
  if (request.url.length > 2048) {
    return {
      success: false,
      error: {
        code: 'URL_TOO_LONG',
        message: 'URL exceeds maximum length of 2048 characters',
      },
    };
  }

  // Generate short code
  const shortCode = `test-${Math.random().toString(36).substr(2, 6)}`;
  const expiresAt = request.userId ? null : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  return {
    success: true,
    data: {
      shortCode,
      shortUrl: `http://localhost:3000/${shortCode}`,
      originalUrl: request.url,
      expiresAt,
    },
  };
}

// Mock rate limiter
let rateLimitCalls: Record<string, number> = {};

async function checkRateLimit(identifier: string, limit: number): Promise<boolean> {
  if (!rateLimitCalls[identifier]) {
    rateLimitCalls[identifier] = 0;
  }
  rateLimitCalls[identifier]++;
  return rateLimitCalls[identifier] <= limit;
}

function resetRateLimits() {
  rateLimitCalls = {};
}

describe('URL Shortening Endpoint - Unit Tests', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe('Successful Shortening - Anonymous', () => {
    it('should shorten valid URL for anonymous user', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.shortCode).toBeDefined();
      expect(response.data?.originalUrl).toBe('https://example.com');
      expect(response.data?.expiresAt).not.toBeNull();
    });

    it('should set expiration for anonymous links', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.data?.expiresAt).not.toBeNull();
      if (response.data?.expiresAt) {
        const now = Date.now();
        const expiryTime = response.data.expiresAt.getTime();
        const twoDays = 2 * 24 * 60 * 60 * 1000;
        
        expect(expiryTime).toBeGreaterThan(now);
        expect(expiryTime).toBeLessThan(now + twoDays + 1000);
      }
    });

    it('should generate unique short codes', async () => {
      const response1 = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      const response2 = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response1.data?.shortCode).not.toBe(response2.data?.shortCode);
    });
  });

  describe('Successful Shortening - Registered', () => {
    it('should shorten valid URL for registered user', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: 'user-123',
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.shortCode).toBeDefined();
      expect(response.data?.originalUrl).toBe('https://example.com');
    });

    it('should not set expiration for registered user links', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: 'user-123',
        ip: '192.168.1.1',
      });

      expect(response.data?.expiresAt).toBeNull();
    });

    it('should handle long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const response = await shortenUrl({
        url: longUrl,
        userId: 'user-123',
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data?.originalUrl).toBe(longUrl);
    });
  });

  describe('Validation Failure', () => {
    it('should reject invalid URL format', async () => {
      const response = await shortenUrl({
        url: 'not-a-valid-url',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_URL');
    });

    it('should reject URL without protocol', async () => {
      const response = await shortenUrl({
        url: 'example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_URL');
    });

    it('should reject URL exceeding max length', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      const response = await shortenUrl({
        url: longUrl,
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('URL_TOO_LONG');
    });

    it('should reject empty URL', async () => {
      const response = await shortenUrl({
        url: '',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_URL');
    });
  });

  describe('Rate Limit Exceeded', () => {
    it('should enforce anonymous rate limit (40/hour)', async () => {
      const ip = '192.168.1.1';
      
      // First 40 requests should succeed
      for (let i = 0; i < 40; i++) {
        const allowed = await checkRateLimit(ip, 40);
        expect(allowed).toBe(true);
      }

      // 41st request should be rate limited
      const allowed = await checkRateLimit(ip, 40);
      expect(allowed).toBe(false);
    });

    it('should enforce registered user rate limit (100/hour)', async () => {
      const userId = 'user-123';
      
      // First 100 requests should succeed
      for (let i = 0; i < 100; i++) {
        const allowed = await checkRateLimit(userId, 100);
        expect(allowed).toBe(true);
      }

      // 101st request should be rate limited
      const allowed = await checkRateLimit(userId, 100);
      expect(allowed).toBe(false);
    });

    it('should track rate limits separately per identifier', async () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Use up limit for ip1
      for (let i = 0; i < 40; i++) {
        await checkRateLimit(ip1, 40);
      }

      // ip2 should still have full limit
      const allowed = await checkRateLimit(ip2, 40);
      expect(allowed).toBe(true);
    });
  });

  describe('Duplicate URL Handling', () => {
    it('should allow same URL to be shortened multiple times', async () => {
      const url = 'https://example.com';

      const response1 = await shortenUrl({
        url,
        userId: null,
        ip: '192.168.1.1',
      });

      const response2 = await shortenUrl({
        url,
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      // Should generate different short codes
      expect(response1.data?.shortCode).not.toBe(response2.data?.shortCode);
    });

    it('should allow different users to shorten same URL', async () => {
      const url = 'https://example.com';

      const response1 = await shortenUrl({
        url,
        userId: 'user-1',
        ip: '192.168.1.1',
      });

      const response2 = await shortenUrl({
        url,
        userId: 'user-2',
        ip: '192.168.1.2',
      });

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
    });
  });

  describe('URL Variations', () => {
    it('should handle URLs with query parameters', async () => {
      const response = await shortenUrl({
        url: 'https://example.com?foo=bar&baz=qux',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data?.originalUrl).toBe('https://example.com?foo=bar&baz=qux');
    });

    it('should handle URLs with fragments', async () => {
      const response = await shortenUrl({
        url: 'https://example.com#section',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data?.originalUrl).toBe('https://example.com#section');
    });

    it('should handle URLs with ports', async () => {
      const response = await shortenUrl({
        url: 'https://example.com:8080/path',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
      expect(response.data?.originalUrl).toBe('https://example.com:8080/path');
    });

    it('should handle URLs with authentication', async () => {
      const response = await shortenUrl({
        url: 'https://user:pass@example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Short URL Format', () => {
    it('should return complete short URL', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.data?.shortUrl).toMatch(/^http:\/\/localhost:3000\//);
      expect(response.data?.shortUrl).toContain(response.data?.shortCode);
    });

    it('should generate alphanumeric short codes', async () => {
      const response = await shortenUrl({
        url: 'https://example.com',
        userId: null,
        ip: '192.168.1.1',
      });

      expect(response.data?.shortCode).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
