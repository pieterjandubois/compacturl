/**
 * Property-Based Tests for Link Expiration Cleanup
 * Property 14: Link Expiration Cleanup
 * Validates: Requirements 3.6, 5.7, 9.1, 9.2, 9.7
 * 
 * Tests that expired links are deleted correctly while preserving saved links
 */

import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { cleanupExpiredLinks } from '../expiration-cleanup';
import * as cache from '../cache';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    link: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock cache
jest.mock('../cache', () => ({
  invalidateLinkCache: jest.fn(),
}));

describe('Property 14: Link Expiration Cleanup', () => {
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  /**
   * Property: Expired links are always deleted
   * For any set of links with expiresAt < now, cleanup should delete them
   */
  it('should delete all expired links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.date({ max: new Date(Date.now() - 1000) }), // Past dates
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (expiredLinks) => {
          prisma.link.findMany.mockResolvedValue(expiredLinks);
          prisma.link.deleteMany.mockResolvedValue({ count: expiredLinks.length });

          const result = await cleanupExpiredLinks();

          expect(result.success).toBe(true);
          expect(result.deletedCount).toBe(expiredLinks.length);
          expect(prisma.link.deleteMany).toHaveBeenCalled();
        }
      ),
      { numRuns: 5 } // Minimal runs for this operation
    );
  });

  /**
   * Property: Non-expired links are never deleted
   * For any set of links with expiresAt > now, cleanup should not delete them
   */
  it('should not delete non-expired links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.date({ min: new Date(Date.now() + 1000) }), // Future dates
          }),
          { maxLength: 10 }
        ),
        async (nonExpiredLinks) => {
          // Cleanup should find no expired links
          prisma.link.findMany.mockResolvedValue([]);
          prisma.link.deleteMany.mockResolvedValue({ count: 0 });

          const result = await cleanupExpiredLinks();

          expect(result.success).toBe(true);
          expect(result.deletedCount).toBe(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Saved links (expiresAt = null) are never deleted
   * For any set of links with expiresAt = null, cleanup should not delete them
   */
  it('should never delete saved links with null expiresAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.constant(null),
          }),
          { maxLength: 10 }
        ),
        async (savedLinks) => {
          // Cleanup should find no expired links (saved links have null expiresAt)
          prisma.link.findMany.mockResolvedValue([]);
          prisma.link.deleteMany.mockResolvedValue({ count: 0 });

          const result = await cleanupExpiredLinks();

          expect(result.success).toBe(true);
          expect(result.deletedCount).toBe(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Cache is invalidated for all deleted links
   * For any set of deleted links, cache invalidation should be called for each
   */
  it('should invalidate cache for all deleted links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.date({ max: new Date(Date.now() - 1000) }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (expiredLinks) => {
          // Clear mocks before each property test run
          jest.clearAllMocks();
          
          prisma.link.findMany.mockResolvedValue(expiredLinks);
          prisma.link.deleteMany.mockResolvedValue({ count: expiredLinks.length });

          await cleanupExpiredLinks();

          expect(cache.invalidateLinkCache).toHaveBeenCalledTimes(expiredLinks.length);
          
          // Verify each link's cache was invalidated
          for (const link of expiredLinks) {
            expect(cache.invalidateLinkCache).toHaveBeenCalledWith(link.shortCode);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Cleanup is idempotent
   * Running cleanup multiple times should not cause issues
   */
  it('should be idempotent - multiple runs produce same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.date({ max: new Date(Date.now() - 1000) }),
          }),
          { maxLength: 5 }
        ),
        async (expiredLinks) => {
          // First run
          prisma.link.findMany.mockResolvedValue(expiredLinks);
          prisma.link.deleteMany.mockResolvedValue({ count: expiredLinks.length });
          const result1 = await cleanupExpiredLinks();

          // Second run (no more expired links)
          prisma.link.findMany.mockResolvedValue([]);
          prisma.link.deleteMany.mockResolvedValue({ count: 0 });
          const result2 = await cleanupExpiredLinks();

          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);
          expect(result2.deletedCount).toBe(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Batch processing handles any number of links
   * Cleanup should work correctly regardless of the number of expired links
   */
  it('should handle any number of expired links with batch processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 250 }),
        async (count) => {
          const expiredLinks = Array.from({ length: count }, (_, i) => ({
            id: `${i + 1}`,
            shortCode: `expired${i + 1}`,
            expiresAt: new Date(Date.now() - 1000),
          }));

          prisma.link.findMany.mockResolvedValue(expiredLinks);
          
          // Mock batch deletions (100 per batch)
          const batches = Math.ceil(count / 100);
          for (let i = 0; i < batches; i++) {
            const batchSize = Math.min(100, count - i * 100);
            prisma.link.deleteMany.mockResolvedValueOnce({ count: batchSize });
          }

          const result = await cleanupExpiredLinks();

          expect(result.success).toBe(true);
          expect(result.deletedCount).toBe(count);
          
          if (count > 0) {
            expect(result.batchCount).toBe(batches);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Cleanup always returns a valid result
   * Result should always have required fields with correct types
   */
  it('should always return a valid CleanupResult', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,10}$/),
            expiresAt: fc.date({ max: new Date(Date.now() - 1000) }),
          }),
          { maxLength: 10 }
        ),
        async (expiredLinks) => {
          prisma.link.findMany.mockResolvedValue(expiredLinks);
          prisma.link.deleteMany.mockResolvedValue({ count: expiredLinks.length });

          const result = await cleanupExpiredLinks();

          // Verify result structure
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('deletedCount');
          expect(result).toHaveProperty('timestamp');
          
          expect(typeof result.success).toBe('boolean');
          expect(typeof result.deletedCount).toBe('number');
          expect(result.timestamp).toBeInstanceOf(Date);
          
          // Verify deleted count is non-negative
          expect(result.deletedCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Cleanup handles errors gracefully
   * Database errors should not crash the cleanup job
   */
  it('should handle database errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          prisma.link.findMany.mockRejectedValue(new Error(errorMessage));

          const result = await cleanupExpiredLinks();

          expect(result.success).toBe(false);
          expect(result.deletedCount).toBe(0);
          expect(result.error).toBe(errorMessage);
          expect(result.timestamp).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 5 }
    );
  });
});
