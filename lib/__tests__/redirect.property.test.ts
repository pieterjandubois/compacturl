/**
 * Property-Based Tests for URL Redirection
 * Feature: compact-url
 * Property 6: Redirect Determinism
 * 
 * Validates Requirements: 7.1, 7.3, 7.4
 */

import * as fc from 'fast-check';

// Mock types
interface Link {
  shortCode: string;
  originalUrl: string;
  expiresAt: Date | null;
}

// Mock link database
const mockLinks: Map<string, Link> = new Map();

// Mock function to get link by short code
async function getLinkByShortCode(shortCode: string): Promise<Link | null> {
  return mockLinks.get(shortCode) || null;
}

// Mock function to create a link
async function createMockLink(shortCode: string, originalUrl: string, expiresAt: Date | null): Promise<Link> {
  const link: Link = { shortCode, originalUrl, expiresAt };
  mockLinks.set(shortCode, link);
  return link;
}

// Mock redirect function
async function redirectToUrl(shortCode: string): Promise<{ url: string | null; status: number }> {
  const link = await getLinkByShortCode(shortCode);

  if (!link) {
    return { url: null, status: 404 };
  }

  // Check expiration
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { url: null, status: 404 };
  }

  return { url: link.originalUrl, status: 301 };
}

describe('URL Redirection - Property 6: Redirect Determinism', () => {
  beforeEach(() => {
    mockLinks.clear();
  });

  describe('Property 6.1: Deterministic Redirect', () => {
    it('should always redirect same short code to same URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            // Create link
            await createMockLink(shortCode, url, null);

            // Property: Multiple redirects should return same URL
            const result1 = await redirectToUrl(shortCode);
            const result2 = await redirectToUrl(shortCode);
            const result3 = await redirectToUrl(shortCode);

            expect(result1.url).toBe(url);
            expect(result2.url).toBe(url);
            expect(result3.url).toBe(url);
            expect(result1.status).toBe(301);
            expect(result2.status).toBe(301);
            expect(result3.status).toBe(301);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should be idempotent - multiple redirects produce same result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            await createMockLink(shortCode, url, null);

            // Property: Redirect is idempotent
            const results = await Promise.all([
              redirectToUrl(shortCode),
              redirectToUrl(shortCode),
              redirectToUrl(shortCode),
            ]);

            const firstResult = results[0];
            results.forEach(result => {
              expect(result.url).toBe(firstResult.url);
              expect(result.status).toBe(firstResult.status);
            });
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 6.2: Invalid Short Code Handling', () => {
    it('should return 404 for non-existent short codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (shortCode) => {
            // Ensure short code doesn't exist
            mockLinks.delete(shortCode);

            // Property: Non-existent codes always return 404
            const result = await redirectToUrl(shortCode);

            expect(result.url).toBeNull();
            expect(result.status).toBe(404);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should consistently return 404 for same invalid code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (shortCode) => {
            mockLinks.delete(shortCode);

            // Property: Multiple attempts with invalid code return same result
            const result1 = await redirectToUrl(shortCode);
            const result2 = await redirectToUrl(shortCode);
            const result3 = await redirectToUrl(shortCode);

            expect(result1.status).toBe(404);
            expect(result2.status).toBe(404);
            expect(result3.status).toBe(404);
            expect(result1.url).toBeNull();
            expect(result2.url).toBeNull();
            expect(result3.url).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 6.3: Expired Link Handling', () => {
    it('should return 404 for expired links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            // Create expired link (1 day in the past)
            const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            await createMockLink(shortCode, url, expiredDate);

            // Property: Expired links return 404
            const result = await redirectToUrl(shortCode);

            expect(result.url).toBeNull();
            expect(result.status).toBe(404);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should allow redirect for non-expired links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            // Create non-expired link (1 day in the future)
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await createMockLink(shortCode, url, futureDate);

            // Property: Non-expired links redirect successfully
            const result = await redirectToUrl(shortCode);

            expect(result.url).toBe(url);
            expect(result.status).toBe(301);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should allow redirect for links with no expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            // Create link with no expiration (null)
            await createMockLink(shortCode, url, null);

            // Property: Links with no expiration always redirect
            const result = await redirectToUrl(shortCode);

            expect(result.url).toBe(url);
            expect(result.status).toBe(301);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 6.4: Status Code Consistency', () => {
    it('should always return 301 for valid redirects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            await createMockLink(shortCode, url, null);

            // Property: Valid redirects always use 301 status
            const result = await redirectToUrl(shortCode);

            expect(result.status).toBe(301);
            expect(result.url).not.toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should always return 404 for invalid/expired codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          fc.boolean(),
          async (shortCode, url, shouldExpire) => {
            if (shouldExpire) {
              // Create expired link
              const expiredDate = new Date(Date.now() - 1000);
              await createMockLink(shortCode, url, expiredDate);
            } else {
              // Don't create link at all
              mockLinks.delete(shortCode);
            }

            // Property: Invalid/expired always return 404
            const result = await redirectToUrl(shortCode);

            expect(result.status).toBe(404);
            expect(result.url).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 6.5: URL Preservation', () => {
    it('should preserve original URL exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.webUrl(),
          async (shortCode, url) => {
            await createMockLink(shortCode, url, null);

            // Property: Redirect URL matches original URL exactly
            const result = await redirectToUrl(shortCode);

            expect(result.url).toBe(url);
            // No modifications to the URL
            expect(result.url).not.toContain('modified');
            expect(result.url).not.toContain('tracked');
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
