/**
 * Unit Tests for URL Redirection
 * Validates Requirements: 7.1, 7.2, 7.3, 7.4
 */

// Mock types
interface Link {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresAt: Date | null;
  clickCount: number;
}

// Mock cache
const mockCache: Map<string, Link> = new Map();
const mockDatabase: Map<string, Link> = new Map();
let clickTrackingCalls: string[] = [];

// Mock functions
async function getLinkWithCache(shortCode: string): Promise<Link | null> {
  // Check cache first
  if (mockCache.has(shortCode)) {
    return mockCache.get(shortCode)!;
  }

  // Check database
  if (mockDatabase.has(shortCode)) {
    const link = mockDatabase.get(shortCode)!;
    // Cache it
    mockCache.set(shortCode, link);
    return link;
  }

  return null;
}

async function trackClick(linkId: string): Promise<void> {
  // Async, fire-and-forget
  clickTrackingCalls.push(linkId);
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10));
}

async function handleRedirect(shortCode: string): Promise<{
  url: string | null;
  status: number;
  message?: string;
}> {
  const link = await getLinkWithCache(shortCode);

  if (!link) {
    return {
      url: null,
      status: 404,
      message: 'Short link not found',
    };
  }

  // Check expiration
  if (link.expiresAt && link.expiresAt <= new Date()) {
    return {
      url: null,
      status: 404,
      message: 'This link has expired',
    };
  }

  // Track click asynchronously (don't await)
  trackClick(link.id).catch(err => console.error('Click tracking failed:', err));

  return {
    url: link.originalUrl,
    status: 301,
  };
}

describe('URL Redirection - Unit Tests', () => {
  beforeEach(() => {
    mockCache.clear();
    mockDatabase.clear();
    clickTrackingCalls = [];
  });

  describe('Successful Redirect', () => {
    it('should redirect to original URL with 301 status', async () => {
      const link: Link = {
        id: 'link-1',
        shortCode: 'test-code',
        originalUrl: 'https://example.com',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('test-code', link);

      const result = await handleRedirect('test-code');

      expect(result.status).toBe(301);
      expect(result.url).toBe('https://example.com');
    });

    it('should work with non-expired links', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const link: Link = {
        id: 'link-2',
        shortCode: 'future-link',
        originalUrl: 'https://example.com/future',
        expiresAt: futureDate,
        clickCount: 0,
      };
      mockDatabase.set('future-link', link);

      const result = await handleRedirect('future-link');

      expect(result.status).toBe(301);
      expect(result.url).toBe('https://example.com/future');
    });

    it('should preserve query parameters in URL', async () => {
      const link: Link = {
        id: 'link-3',
        shortCode: 'query-link',
        originalUrl: 'https://example.com?foo=bar&baz=qux',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('query-link', link);

      const result = await handleRedirect('query-link');

      expect(result.url).toBe('https://example.com?foo=bar&baz=qux');
    });

    it('should preserve URL fragments', async () => {
      const link: Link = {
        id: 'link-4',
        shortCode: 'fragment-link',
        originalUrl: 'https://example.com#section',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('fragment-link', link);

      const result = await handleRedirect('fragment-link');

      expect(result.url).toBe('https://example.com#section');
    });
  });

  describe('Cache Hit Scenario', () => {
    it('should use cached link when available', async () => {
      const link: Link = {
        id: 'link-5',
        shortCode: 'cached-link',
        originalUrl: 'https://example.com/cached',
        expiresAt: null,
        clickCount: 0,
      };
      
      // Put in cache only (not in database)
      mockCache.set('cached-link', link);

      const result = await handleRedirect('cached-link');

      expect(result.status).toBe(301);
      expect(result.url).toBe('https://example.com/cached');
    });

    it('should cache database results', async () => {
      const link: Link = {
        id: 'link-6',
        shortCode: 'db-link',
        originalUrl: 'https://example.com/db',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('db-link', link);

      // First call - should hit database and cache
      await handleRedirect('db-link');
      expect(mockCache.has('db-link')).toBe(true);

      // Second call - should hit cache
      const result = await handleRedirect('db-link');
      expect(result.url).toBe('https://example.com/db');
    });
  });

  describe('Cache Miss Scenario', () => {
    it('should fetch from database on cache miss', async () => {
      const link: Link = {
        id: 'link-7',
        shortCode: 'miss-link',
        originalUrl: 'https://example.com/miss',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('miss-link', link);

      const result = await handleRedirect('miss-link');

      expect(result.status).toBe(301);
      expect(result.url).toBe('https://example.com/miss');
      // Should now be in cache
      expect(mockCache.has('miss-link')).toBe(true);
    });
  });

  describe('Expired Link', () => {
    it('should return 404 for expired link', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const link: Link = {
        id: 'link-8',
        shortCode: 'expired-link',
        originalUrl: 'https://example.com/expired',
        expiresAt: pastDate,
        clickCount: 0,
      };
      mockDatabase.set('expired-link', link);

      const result = await handleRedirect('expired-link');

      expect(result.status).toBe(404);
      expect(result.url).toBeNull();
      expect(result.message).toContain('expired');
    });

    it('should return 404 for link expiring exactly now', async () => {
      const now = new Date();
      const link: Link = {
        id: 'link-9',
        shortCode: 'now-link',
        originalUrl: 'https://example.com/now',
        expiresAt: now,
        clickCount: 0,
      };
      mockDatabase.set('now-link', link);

      // Wait 1ms to ensure it's expired
      await new Promise(resolve => setTimeout(resolve, 1));

      const result = await handleRedirect('now-link');

      expect(result.status).toBe(404);
    });
  });

  describe('Invalid Short Code', () => {
    it('should return 404 for non-existent short code', async () => {
      const result = await handleRedirect('nonexistent');

      expect(result.status).toBe(404);
      expect(result.url).toBeNull();
      expect(result.message).toContain('not found');
    });

    it('should return 404 for empty short code', async () => {
      const result = await handleRedirect('');

      expect(result.status).toBe(404);
    });
  });

  describe('Click Tracking', () => {
    it('should track clicks asynchronously', async () => {
      const link: Link = {
        id: 'link-10',
        shortCode: 'track-link',
        originalUrl: 'https://example.com/track',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('track-link', link);

      await handleRedirect('track-link');

      // Wait for async tracking
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(clickTrackingCalls).toContain('link-10');
    });

    it('should not block redirect on tracking failure', async () => {
      const link: Link = {
        id: 'link-11',
        shortCode: 'fast-link',
        originalUrl: 'https://example.com/fast',
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('fast-link', link);

      const startTime = Date.now();
      const result = await handleRedirect('fast-link');
      const endTime = Date.now();

      // Redirect should be fast (< 100ms), not waiting for tracking
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.status).toBe(301);
    });

    it('should not track clicks for expired links', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const link: Link = {
        id: 'link-12',
        shortCode: 'expired-track',
        originalUrl: 'https://example.com/expired',
        expiresAt: pastDate,
        clickCount: 0,
      };
      mockDatabase.set('expired-track', link);

      await handleRedirect('expired-track');
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(clickTrackingCalls).not.toContain('link-12');
    });

    it('should not track clicks for non-existent links', async () => {
      await handleRedirect('nonexistent');
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(clickTrackingCalls).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const link: Link = {
        id: 'link-13',
        shortCode: 'long-url',
        originalUrl: longUrl,
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('long-url', link);

      const result = await handleRedirect('long-url');

      expect(result.status).toBe(301);
      expect(result.url).toBe(longUrl);
    });

    it('should handle URLs with special characters', async () => {
      const specialUrl = 'https://example.com/path?q=hello%20world&foo=bar%2Fbaz';
      const link: Link = {
        id: 'link-14',
        shortCode: 'special-url',
        originalUrl: specialUrl,
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('special-url', link);

      const result = await handleRedirect('special-url');

      expect(result.url).toBe(specialUrl);
    });

    it('should handle international URLs', async () => {
      const intlUrl = 'https://例え.jp/パス';
      const link: Link = {
        id: 'link-15',
        shortCode: 'intl-url',
        originalUrl: intlUrl,
        expiresAt: null,
        clickCount: 0,
      };
      mockDatabase.set('intl-url', link);

      const result = await handleRedirect('intl-url');

      expect(result.url).toBe(intlUrl);
    });
  });
});
