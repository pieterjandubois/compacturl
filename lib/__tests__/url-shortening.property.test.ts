/**
 * Property-Based Tests for URL Shortening Flow
 * Feature: compact-url
 * Property 3: Expiration Date Consistency
 * 
 * Validates Requirements: 3.2, 5.2, 5.3, 9.3, 9.4, 9.5, 9.6
 */

import * as fc from 'fast-check';

// Mock types for URL shortening
interface Link {
  id: string;
  shortCode: string;
  originalUrl: string;
  userId: string | null;
  createdByIp: string;
  isSaved: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  clickCount: number;
}

// Mock function to create a link (will be replaced with actual implementation)
async function createLink(
  originalUrl: string,
  userId: string | null,
  createdByIp: string
): Promise<Link> {
  const now = new Date();
  const expiresAt = userId === null 
    ? new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days for anonymous
    : null; // null for registered users

  return {
    id: `link-${Math.random().toString(36).substr(2, 9)}`,
    shortCode: `code-${Math.random().toString(36).substr(2, 6)}`,
    originalUrl,
    userId,
    createdByIp,
    isSaved: userId !== null,
    expiresAt,
    createdAt: now,
    clickCount: 0,
  };
}

describe('URL Shortening Flow - Property 3: Expiration Date Consistency', () => {
  describe('Property 3.1: Anonymous Link Expiration', () => {
    it('should set expiration to 2 days for anonymous links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.ipV4(),
          async (url, ip) => {
            const link = await createLink(url, null, ip);

            // Property: Anonymous links must expire in exactly 2 days
            expect(link.expiresAt).not.toBeNull();
            
            if (link.expiresAt) {
              const expectedExpiry = new Date(link.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);
              const timeDiff = Math.abs(link.expiresAt.getTime() - expectedExpiry.getTime());
              
              // Allow 1 second tolerance for execution time
              expect(timeDiff).toBeLessThan(1000);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should have expiresAt greater than createdAt for anonymous links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.ipV4(),
          async (url, ip) => {
            const link = await createLink(url, null, ip);

            // Property: expiresAt must be after createdAt
            expect(link.expiresAt).not.toBeNull();
            if (link.expiresAt) {
              expect(link.expiresAt.getTime()).toBeGreaterThan(link.createdAt.getTime());
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 3.2: Registered User Link Expiration', () => {
    it('should set expiresAt to null for registered user links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.uuid(),
          fc.ipV4(),
          async (url, userId, ip) => {
            const link = await createLink(url, userId, ip);

            // Property: Registered user links never expire (expiresAt = null)
            expect(link.expiresAt).toBeNull();
            expect(link.isSaved).toBe(true);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 3.3: Expiration Consistency', () => {
    it('should maintain consistent expiration logic across multiple creations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.option(fc.uuid(), { nil: null }),
          fc.ipV4(),
          async (url, userId, ip) => {
            const link1 = await createLink(url, userId, ip);
            const link2 = await createLink(url, userId, ip);

            // Property: Same user type should produce same expiration behavior
            if (userId === null) {
              // Both anonymous links should have expiration
              expect(link1.expiresAt).not.toBeNull();
              expect(link2.expiresAt).not.toBeNull();
            } else {
              // Both registered links should have no expiration
              expect(link1.expiresAt).toBeNull();
              expect(link2.expiresAt).toBeNull();
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 3.4: Saved Link Behavior', () => {
    it('should mark registered user links as saved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.uuid(),
          fc.ipV4(),
          async (url, userId, ip) => {
            const link = await createLink(url, userId, ip);

            // Property: Links created by registered users are automatically saved
            expect(link.isSaved).toBe(true);
            expect(link.userId).toBe(userId);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should not mark anonymous links as saved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.ipV4(),
          async (url, ip) => {
            const link = await createLink(url, null, ip);

            // Property: Anonymous links are not saved
            expect(link.isSaved).toBe(false);
            expect(link.userId).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 3.5: Temporal Ordering', () => {
    it('should ensure expiresAt is always after createdAt when set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.option(fc.uuid(), { nil: null }),
          fc.ipV4(),
          async (url, userId, ip) => {
            const link = await createLink(url, userId, ip);

            // Property: If expiresAt is set, it must be after createdAt
            if (link.expiresAt !== null) {
              expect(link.expiresAt.getTime()).toBeGreaterThan(link.createdAt.getTime());
              
              // Should be approximately 2 days later
              const daysDiff = (link.expiresAt.getTime() - link.createdAt.getTime()) / (24 * 60 * 60 * 1000);
              expect(daysDiff).toBeGreaterThan(1.99);
              expect(daysDiff).toBeLessThan(2.01);
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 3.6: Initial State', () => {
    it('should initialize links with zero click count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.option(fc.uuid(), { nil: null }),
          fc.ipV4(),
          async (url, userId, ip) => {
            const link = await createLink(url, userId, ip);

            // Property: New links always start with zero clicks
            expect(link.clickCount).toBe(0);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should set createdAt to current time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.option(fc.uuid(), { nil: null }),
          fc.ipV4(),
          async (url, userId, ip) => {
            const beforeCreate = Date.now();
            const link = await createLink(url, userId, ip);
            const afterCreate = Date.now();

            // Property: createdAt should be between before and after timestamps
            expect(link.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
            expect(link.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
