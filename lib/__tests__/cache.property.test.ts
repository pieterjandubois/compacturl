/**
 * Property-Based Tests for Cache Consistency
 * 
 * **Validates: Requirements 7.5, 7.6, 7.7**
 * **Property 7: Cache Consistency**
 * 
 * Tests cache-aside pattern correctness using property-based testing:
 * - Cached data matches database data
 * - Cache invalidation works correctly
 * - Cache population after database fetch
 * - Cache-aside pattern maintains consistency
 * 
 * Tag: Feature: compact-url, Property 7: Cache Consistency
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import Redis from 'ioredis-mock';
import { PrismaClient, Link } from '@prisma/client';
import {
  cacheLink,
  getCachedLink,
  invalidateLinkCache,
  getLinkWithCache,
  CachedLink,
} from '../cache';

// Mock Redis client
let mockRedis: Redis;

// Mock Prisma client
let mockPrisma: any;

beforeEach(() => {
  // Create fresh mock Redis instance for each test
  mockRedis = new Redis();
  
  // Create mock Prisma client
  mockPrisma = {
    link: {
      findUnique: jest.fn(),
    },
  };
});

afterEach(async () => {
  // Clean up Redis
  await mockRedis.flushall();
  await mockRedis.quit();
  
  // Clear all mocks
  jest.clearAllMocks();
});

/**
 * Arbitrary generator for short codes
 * Generates valid short codes (alphanumeric + hyphens, 1-15 chars)
 */
const shortCodeArbitrary = fc.stringMatching(/^[a-z0-9-]{1,15}$/);

/**
 * Arbitrary generator for URLs
 * Generates valid HTTP/HTTPS URLs
 */
const urlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

/**
 * Arbitrary generator for user IDs
 * Generates UUID-like strings or null (for anonymous links)
 */
const userIdArbitrary = fc.oneof(
  fc.uuid(),
  fc.constant(null)
);

/**
 * Arbitrary generator for expiration dates
 * Generates future dates or null (never expires)
 */
const expiresAtArbitrary = fc.oneof(
  fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
  fc.constant(null)
);

/**
 * Arbitrary generator for isSaved boolean
 */
const isSavedArbitrary = fc.boolean();

/**
 * Arbitrary generator for CachedLink data
 */
const cachedLinkArbitrary = fc.record({
  originalUrl: urlArbitrary,
  userId: userIdArbitrary,
  expiresAt: expiresAtArbitrary,
  isSaved: isSavedArbitrary,
});

/**
 * Arbitrary generator for full Link objects (from database)
 */
const linkArbitrary = fc.record({
  id: fc.uuid(),
  shortCode: shortCodeArbitrary,
  originalUrl: urlArbitrary,
  userId: userIdArbitrary,
  createdAt: fc.date({ max: new Date() }),
  updatedAt: fc.date({ max: new Date() }),
  expiresAt: expiresAtArbitrary,
  clickCount: fc.nat({ max: 10000 }),
  createdByIp: fc.ipV4(),
  isSaved: isSavedArbitrary,
});

describe('Property 7: Cache Consistency', () => {
  /**
   * Property 7.1: Cached data matches database data
   * 
   * FOR ALL links, when cached and retrieved, the essential fields
   * (originalUrl, userId, expiresAt, isSaved) SHALL match exactly
   */
  it('Property 7.1: Cached data matches database data', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        cachedLinkArbitrary,
        async (shortCode, linkData) => {
          // Cache the link
          await cacheLink(shortCode, linkData, mockRedis);
          
          // Retrieve from cache
          const retrieved = await getCachedLink(shortCode, mockRedis);
          
          // Verify all fields match
          expect(retrieved).not.toBeNull();
          expect(retrieved!.originalUrl).toBe(linkData.originalUrl);
          expect(retrieved!.userId).toBe(linkData.userId);
          expect(retrieved!.isSaved).toBe(linkData.isSaved);
          
          // Handle date comparison (may be string after JSON parse)
          if (linkData.expiresAt === null) {
            expect(retrieved!.expiresAt).toBeNull();
          } else {
            expect(retrieved!.expiresAt).toBeTruthy();
            // Convert to timestamps for comparison
            const cachedTime = new Date(retrieved!.expiresAt!).getTime();
            const originalTime = linkData.expiresAt.getTime();
            expect(cachedTime).toBe(originalTime);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.2: Cache invalidation removes data
   * 
   * FOR ALL cached links, after invalidation, getCachedLink SHALL return null
   */
  it('Property 7.2: Cache invalidation removes data', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        cachedLinkArbitrary,
        async (shortCode, linkData) => {
          // Cache the link
          await cacheLink(shortCode, linkData, mockRedis);
          
          // Verify it's cached
          const beforeInvalidation = await getCachedLink(shortCode, mockRedis);
          expect(beforeInvalidation).not.toBeNull();
          
          // Invalidate
          await invalidateLinkCache(shortCode, mockRedis);
          
          // Verify it's gone
          const afterInvalidation = await getCachedLink(shortCode, mockRedis);
          expect(afterInvalidation).toBeNull();
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.3: Cache-aside pattern - cache hit avoids database query
   * 
   * FOR ALL cached links, getLinkWithCache SHALL return data from cache
   * without querying the database
   */
  it('Property 7.3: Cache-aside pattern - cache hit avoids database query', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        cachedLinkArbitrary,
        async (shortCode, linkData) => {
          // Pre-populate cache
          await cacheLink(shortCode, linkData, mockRedis);
          
          // Reset mock to track calls
          mockPrisma.link.findUnique.mockClear();
          
          // Get link with cache (should hit cache)
          const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
          
          // Verify data is returned
          expect(result).not.toBeNull();
          expect(result!.originalUrl).toBe(linkData.originalUrl);
          
          // Verify database was NOT queried
          expect(mockPrisma.link.findUnique).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.4: Cache-aside pattern - cache miss queries database and populates cache
   * 
   * FOR ALL links in database, when cache is empty, getLinkWithCache SHALL:
   * 1. Query the database
   * 2. Return the link data
   * 3. Populate the cache
   */
  it('Property 7.4: Cache-aside pattern - cache miss queries database and populates cache', async () => {
    await fc.assert(
      fc.asyncProperty(
        linkArbitrary,
        async (dbLink) => {
          // Mock database to return the link
          mockPrisma.link.findUnique.mockResolvedValue(dbLink);
          
          // Ensure cache is empty
          await invalidateLinkCache(dbLink.shortCode, mockRedis);
          
          // Get link (cache miss)
          const result = await getLinkWithCache(dbLink.shortCode, mockPrisma, mockRedis);
          
          // Verify data is returned from database
          expect(result).not.toBeNull();
          expect(result!.shortCode).toBe(dbLink.shortCode);
          expect(result!.originalUrl).toBe(dbLink.originalUrl);
          expect(result!.userId).toBe(dbLink.userId);
          
          // Verify database was queried
          expect(mockPrisma.link.findUnique).toHaveBeenCalledWith({
            where: { shortCode: dbLink.shortCode },
          });
          
          // Verify cache was populated
          const cached = await getCachedLink(dbLink.shortCode, mockRedis);
          expect(cached).not.toBeNull();
          expect(cached!.originalUrl).toBe(dbLink.originalUrl);
          expect(cached!.userId).toBe(dbLink.userId);
          expect(cached!.isSaved).toBe(dbLink.isSaved);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.5: Cache consistency after update
   * 
   * FOR ALL links, after cache invalidation, the next fetch SHALL get fresh data
   * from the database, not stale cached data
   */
  it('Property 7.5: Cache consistency after update', async () => {
    await fc.assert(
      fc.asyncProperty(
        linkArbitrary,
        urlArbitrary,
        async (originalLink, newUrl) => {
          // Assume newUrl is different from original
          fc.pre(newUrl !== originalLink.originalUrl);
          
          // Cache the original link
          await cacheLink(
            originalLink.shortCode,
            {
              originalUrl: originalLink.originalUrl,
              userId: originalLink.userId,
              expiresAt: originalLink.expiresAt,
              isSaved: originalLink.isSaved,
            },
            mockRedis
          );
          
          // Simulate link update by invalidating cache
          await invalidateLinkCache(originalLink.shortCode, mockRedis);
          
          // Mock database to return updated link
          const updatedLink = { ...originalLink, originalUrl: newUrl };
          mockPrisma.link.findUnique.mockResolvedValue(updatedLink);
          
          // Fetch link (should get updated data from database)
          const result = await getLinkWithCache(originalLink.shortCode, mockPrisma, mockRedis);
          
          // Verify we got the updated URL, not the cached one
          expect(result).not.toBeNull();
          expect(result!.originalUrl).toBe(newUrl);
          expect(result!.originalUrl).not.toBe(originalLink.originalUrl);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.6: Multiple cache operations maintain consistency
   * 
   * FOR ALL sequences of cache operations (cache, get, invalidate, cache again),
   * the final state SHALL be consistent with the last operation
   */
  it('Property 7.6: Multiple cache operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        fc.array(cachedLinkArbitrary, { minLength: 2, maxLength: 5 }),
        async (shortCode, linkDataArray) => {
          // Perform sequence of cache operations
          for (let i = 0; i < linkDataArray.length; i++) {
            const linkData = linkDataArray[i];
            
            // Cache the link
            await cacheLink(shortCode, linkData, mockRedis);
            
            // Verify it's cached with correct data
            const retrieved = await getCachedLink(shortCode, mockRedis);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.originalUrl).toBe(linkData.originalUrl);
            
            // Invalidate (except for last iteration)
            if (i < linkDataArray.length - 1) {
              await invalidateLinkCache(shortCode, mockRedis);
              
              // Verify it's gone
              const afterInvalidation = await getCachedLink(shortCode, mockRedis);
              expect(afterInvalidation).toBeNull();
            }
          }
          
          // Final state should have the last link data
          const finalRetrieved = await getCachedLink(shortCode, mockRedis);
          const lastLinkData = linkDataArray[linkDataArray.length - 1];
          expect(finalRetrieved).not.toBeNull();
          expect(finalRetrieved!.originalUrl).toBe(lastLinkData.originalUrl);
          expect(finalRetrieved!.userId).toBe(lastLinkData.userId);
          expect(finalRetrieved!.isSaved).toBe(lastLinkData.isSaved);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.7: Cache TTL is set correctly
   * 
   * FOR ALL cached links, the TTL SHALL be approximately 3600 seconds (1 hour)
   */
  it('Property 7.7: Cache TTL is set correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        cachedLinkArbitrary,
        async (shortCode, linkData) => {
          // Cache the link
          await cacheLink(shortCode, linkData, mockRedis);
          
          // Check TTL
          const ttl = await mockRedis.ttl(`link:${shortCode}`);
          
          // TTL should be close to 3600 seconds (allow small variance)
          expect(ttl).toBeGreaterThan(3590);
          expect(ttl).toBeLessThanOrEqual(3600);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.8: Cache handles null values correctly
   * 
   * FOR ALL links with null userId or null expiresAt, caching and retrieval
   * SHALL preserve the null values
   */
  it('Property 7.8: Cache handles null values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        urlArbitrary,
        fc.boolean(),
        async (shortCode, originalUrl, isSaved) => {
          // Create link data with null values
          const linkData: CachedLink = {
            originalUrl,
            userId: null,
            expiresAt: null,
            isSaved,
          };
          
          // Cache the link
          await cacheLink(shortCode, linkData, mockRedis);
          
          // Retrieve from cache
          const retrieved = await getCachedLink(shortCode, mockRedis);
          
          // Verify null values are preserved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.userId).toBeNull();
          expect(retrieved!.expiresAt).toBeNull();
          expect(retrieved!.originalUrl).toBe(originalUrl);
          expect(retrieved!.isSaved).toBe(isSaved);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.9: Concurrent cache operations maintain consistency
   * 
   * FOR ALL links, concurrent cache and invalidate operations SHALL not
   * leave the cache in an inconsistent state
   */
  it('Property 7.9: Concurrent cache operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        fc.array(cachedLinkArbitrary, { minLength: 3, maxLength: 10 }),
        async (shortCode, linkDataArray) => {
          // Perform concurrent cache operations
          const operations = linkDataArray.map((linkData, index) => {
            if (index % 2 === 0) {
              // Even indices: cache
              return cacheLink(shortCode, linkData, mockRedis);
            } else {
              // Odd indices: invalidate
              return invalidateLinkCache(shortCode, mockRedis);
            }
          });
          
          // Wait for all operations to complete
          await Promise.all(operations);
          
          // Final state should be consistent (either cached or not cached)
          const finalRetrieved = await getCachedLink(shortCode, mockRedis);
          
          // If last operation was cache (even index), should be cached
          // If last operation was invalidate (odd index), should be null
          const lastIndex = linkDataArray.length - 1;
          if (lastIndex % 2 === 0) {
            // Last was cache
            expect(finalRetrieved).not.toBeNull();
          } else {
            // Last was invalidate
            expect(finalRetrieved).toBeNull();
          }
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 7.10: Cache-aside pattern with non-existent links
   * 
   * FOR ALL non-existent short codes, getLinkWithCache SHALL:
   * 1. Query the database
   * 2. Return null
   * 3. NOT populate the cache
   */
  it('Property 7.10: Cache-aside pattern with non-existent links', async () => {
    await fc.assert(
      fc.asyncProperty(
        shortCodeArbitrary,
        async (shortCode) => {
          // Mock database to return null (link not found)
          mockPrisma.link.findUnique.mockResolvedValue(null);
          
          // Ensure cache is empty
          await invalidateLinkCache(shortCode, mockRedis);
          
          // Get link (should return null)
          const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
          
          // Verify null is returned
          expect(result).toBeNull();
          
          // Verify database was queried
          expect(mockPrisma.link.findUnique).toHaveBeenCalledWith({
            where: { shortCode },
          });
          
          // Verify cache was NOT populated
          const cached = await getCachedLink(shortCode, mockRedis);
          expect(cached).toBeNull();
        }
      ),
      { numRuns: 25 }
    );
  });
});
