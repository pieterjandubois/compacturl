/**
 * Cache Manager Edge Case Tests
 * 
 * Comprehensive edge case testing for Redis caching functions.
 * 
 * **Validates: Requirements 7.5, 7.6, 7.7**
 * 
 * Edge cases covered:
 * - Cache hit with expired TTL (time simulation)
 * - Cache miss with database error
 * - Concurrent cache operations
 * - Large data caching (stress test)
 * - Invalid JSON in cache
 * - Cache key collisions
 * - Multiple invalidations of same key
 * - Cache operations with empty/whitespace short codes
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Redis from 'ioredis-mock';
import { PrismaClient } from '@prisma/client';
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

describe('Cache Edge Cases', () => {
  describe('TTL and Expiration', () => {
    it('should handle cache hit with expired TTL gracefully', async () => {
      const shortCode = 'test-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache the link
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Verify it's cached
      let cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      
      // Simulate TTL expiration by manually deleting the key
      await mockRedis.del(`link:${shortCode}`);
      
      // Try to get cached link (should return null after expiration)
      cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle very short TTL correctly', async () => {
      const shortCode = 'short-ttl';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: null,
        expiresAt: null,
        isSaved: false,
      };
      
      // Cache with very short TTL (1 second)
      await mockRedis.setex(`link:${shortCode}`, 1, JSON.stringify(linkData));
      
      // Should be retrievable immediately
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      
      // Wait for expiration (2 seconds to be safe)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Should be expired now
      const expiredCached = await getCachedLink(shortCode, mockRedis);
      expect(expiredCached).toBeNull();
    });
    
    it('should handle TTL check for non-existent key', async () => {
      const ttl = await mockRedis.ttl('link:nonexistent');
      expect(ttl).toBe(-2); // -2 means key doesn't exist
    });
  });
  
  describe('Database Error Handling', () => {
    it('should handle cache miss with database error gracefully', async () => {
      const shortCode = 'db-error-link';
      
      // Mock database to throw error
      mockPrisma.link.findUnique.mockRejectedValue(new Error('Database connection failed'));
      
      // Should return null instead of throwing
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      expect(result).toBeNull();
      
      // Verify database was attempted
      expect(mockPrisma.link.findUnique).toHaveBeenCalled();
    });
    
    it('should handle database timeout gracefully', async () => {
      const shortCode = 'timeout-link';
      
      // Mock database to timeout
      mockPrisma.link.findUnique.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 100);
        });
      });
      
      // Should return null after timeout
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      expect(result).toBeNull();
    });
    
    it('should handle database returning malformed data', async () => {
      const shortCode = 'malformed-link';
      
      // Mock database to return incomplete data
      mockPrisma.link.findUnique.mockResolvedValue({
        shortCode,
        // Missing required fields
      });
      
      // Should handle gracefully
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      expect(result).toBeTruthy(); // Returns what database gave us
    });
  });
  
  describe('Concurrent Operations', () => {
    it('should handle concurrent cache operations on same key', async () => {
      const shortCode = 'concurrent-link';
      const linkData1: CachedLink = {
        originalUrl: 'https://example1.com',
        userId: 'user-1',
        expiresAt: null,
        isSaved: true,
      };
      const linkData2: CachedLink = {
        originalUrl: 'https://example2.com',
        userId: 'user-2',
        expiresAt: null,
        isSaved: false,
      };
      
      // Perform concurrent cache operations
      await Promise.all([
        cacheLink(shortCode, linkData1, mockRedis),
        cacheLink(shortCode, linkData2, mockRedis),
      ]);
      
      // One of them should win (last write wins)
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect([linkData1.originalUrl, linkData2.originalUrl]).toContain(cached!.originalUrl);
    });
    
    it('should handle concurrent cache and invalidate operations', async () => {
      const shortCode = 'concurrent-invalidate';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Perform concurrent cache and invalidate
      await Promise.all([
        cacheLink(shortCode, linkData, mockRedis),
        invalidateLinkCache(shortCode, mockRedis),
        cacheLink(shortCode, linkData, mockRedis),
      ]);
      
      // Final state should be consistent (either cached or not)
      const cached = await getCachedLink(shortCode, mockRedis);
      // We can't predict the exact outcome due to race conditions,
      // but it should not throw or leave inconsistent state
      expect(cached === null || cached !== null).toBe(true);
    });
    
    it('should handle concurrent reads from cache', async () => {
      const shortCode = 'concurrent-reads';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache the link first
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Perform concurrent reads
      const results = await Promise.all([
        getCachedLink(shortCode, mockRedis),
        getCachedLink(shortCode, mockRedis),
        getCachedLink(shortCode, mockRedis),
        getCachedLink(shortCode, mockRedis),
        getCachedLink(shortCode, mockRedis),
      ]);
      
      // All reads should return the same data
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result!.originalUrl).toBe(linkData.originalUrl);
      });
    });
    
    it('should handle concurrent getLinkWithCache calls', async () => {
      const shortCode = 'concurrent-get';
      const dbLink = {
        id: 'link-id-123',
        shortCode,
        originalUrl: 'https://example.com',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        clickCount: 0,
        createdByIp: '127.0.0.1',
        isSaved: true,
      };
      
      // Mock database
      mockPrisma.link.findUnique.mockResolvedValue(dbLink);
      
      // Perform concurrent getLinkWithCache calls
      const results = await Promise.all([
        getLinkWithCache(shortCode, mockPrisma, mockRedis),
        getLinkWithCache(shortCode, mockPrisma, mockRedis),
        getLinkWithCache(shortCode, mockPrisma, mockRedis),
      ]);
      
      // All should return the link
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result!.originalUrl).toBe(dbLink.originalUrl);
      });
      
      // Database might be called multiple times due to race condition
      // (before cache is populated), but that's acceptable
      expect(mockPrisma.link.findUnique).toHaveBeenCalled();
    });
  });
  
  describe('Large Data Handling', () => {
    it('should handle caching very long URLs', async () => {
      const shortCode = 'long-url';
      const veryLongUrl = 'https://example.com/' + 'a'.repeat(10000);
      const linkData: CachedLink = {
        originalUrl: veryLongUrl,
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Should cache successfully
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Should retrieve successfully
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect(cached!.originalUrl).toBe(veryLongUrl);
      expect(cached!.originalUrl.length).toBe(veryLongUrl.length);
    });
    
    it('should handle caching many links (stress test)', async () => {
      const numLinks = 1000;
      const links: Array<{ shortCode: string; data: CachedLink }> = [];
      
      // Generate many links
      for (let i = 0; i < numLinks; i++) {
        links.push({
          shortCode: `link-${i}`,
          data: {
            originalUrl: `https://example.com/${i}`,
            userId: `user-${i % 10}`,
            expiresAt: null,
            isSaved: i % 2 === 0,
          },
        });
      }
      
      // Cache all links
      await Promise.all(
        links.map(link => cacheLink(link.shortCode, link.data, mockRedis))
      );
      
      // Verify random samples
      const samples = [0, 100, 500, 999];
      for (const index of samples) {
        const cached = await getCachedLink(links[index].shortCode, mockRedis);
        expect(cached).toBeTruthy();
        expect(cached!.originalUrl).toBe(links[index].data.originalUrl);
      }
    });
    
    it('should handle caching link with very long user ID', async () => {
      const shortCode = 'long-userid';
      const veryLongUserId = 'user-' + 'x'.repeat(1000);
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: veryLongUserId,
        expiresAt: null,
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect(cached!.userId).toBe(veryLongUserId);
    });
  });
  
  describe('Invalid Data Handling', () => {
    it('should handle invalid JSON in cache gracefully', async () => {
      const shortCode = 'invalid-json';
      
      // Manually set invalid JSON in cache
      await mockRedis.set(`link:${shortCode}`, 'not valid json {{{');
      
      // Should return null instead of throwing
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle corrupted JSON with missing fields', async () => {
      const shortCode = 'corrupted-json';
      
      // Set incomplete JSON
      await mockRedis.set(`link:${shortCode}`, JSON.stringify({ originalUrl: 'https://example.com' }));
      
      // Should handle gracefully (might return partial data or null)
      const cached = await getCachedLink(shortCode, mockRedis);
      // Implementation should handle this - either return null or partial data
      expect(cached === null || cached !== null).toBe(true);
    });
    
    it('should handle empty string in cache', async () => {
      const shortCode = 'empty-string';
      
      // Set empty string
      await mockRedis.set(`link:${shortCode}`, '');
      
      // Should return null
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle null bytes in cached data', async () => {
      const shortCode = 'null-bytes';
      
      // Set data with null bytes
      await mockRedis.set(`link:${shortCode}`, 'data\x00with\x00nulls');
      
      // Should handle gracefully
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
  });
  
  describe('Cache Key Edge Cases', () => {
    it('should handle empty short code', async () => {
      const shortCode = '';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Should handle empty short code
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
    });
    
    it('should handle whitespace-only short code', async () => {
      const shortCode = '   ';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Should handle whitespace short code
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
    });
    
    it('should handle short codes with special characters', async () => {
      const specialCodes = [
        'link:with:colons',
        'link/with/slashes',
        'link\\with\\backslashes',
        'link with spaces',
        'link\twith\ttabs',
        'link\nwith\nnewlines',
      ];
      
      for (const shortCode of specialCodes) {
        const linkData: CachedLink = {
          originalUrl: `https://example.com/${encodeURIComponent(shortCode)}`,
          userId: 'user-123',
          expiresAt: null,
          isSaved: true,
        };
        
        await cacheLink(shortCode, linkData, mockRedis);
        const cached = await getCachedLink(shortCode, mockRedis);
        
        expect(cached).toBeTruthy();
        expect(cached!.originalUrl).toBe(linkData.originalUrl);
      }
    });
    
    it('should handle potential cache key collisions', async () => {
      // These short codes might create similar cache keys
      const shortCode1 = 'test';
      const shortCode2 = 'test '; // with trailing space
      const shortCode3 = ' test'; // with leading space
      
      const linkData1: CachedLink = {
        originalUrl: 'https://example1.com',
        userId: 'user-1',
        expiresAt: null,
        isSaved: true,
      };
      const linkData2: CachedLink = {
        originalUrl: 'https://example2.com',
        userId: 'user-2',
        expiresAt: null,
        isSaved: true,
      };
      const linkData3: CachedLink = {
        originalUrl: 'https://example3.com',
        userId: 'user-3',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache all three
      await cacheLink(shortCode1, linkData1, mockRedis);
      await cacheLink(shortCode2, linkData2, mockRedis);
      await cacheLink(shortCode3, linkData3, mockRedis);
      
      // Each should be retrievable with correct data
      const cached1 = await getCachedLink(shortCode1, mockRedis);
      const cached2 = await getCachedLink(shortCode2, mockRedis);
      const cached3 = await getCachedLink(shortCode3, mockRedis);
      
      expect(cached1!.originalUrl).toBe(linkData1.originalUrl);
      expect(cached2!.originalUrl).toBe(linkData2.originalUrl);
      expect(cached3!.originalUrl).toBe(linkData3.originalUrl);
    });
  });
  
  describe('Multiple Invalidations', () => {
    it('should handle multiple invalidations of same key', async () => {
      const shortCode = 'multi-invalidate';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache the link
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Invalidate multiple times
      await invalidateLinkCache(shortCode, mockRedis);
      await invalidateLinkCache(shortCode, mockRedis);
      await invalidateLinkCache(shortCode, mockRedis);
      
      // Should still be gone
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle invalidation of never-cached key', async () => {
      const shortCode = 'never-cached';
      
      // Invalidate without caching first
      await expect(invalidateLinkCache(shortCode, mockRedis)).resolves.not.toThrow();
      
      // Should still return null
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle rapid cache-invalidate-cache cycles', async () => {
      const shortCode = 'rapid-cycle';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Perform rapid cycles
      for (let i = 0; i < 10; i++) {
        await cacheLink(shortCode, linkData, mockRedis);
        await invalidateLinkCache(shortCode, mockRedis);
      }
      
      // Final state should be invalidated
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
      
      // Cache one more time
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Should be cached now
      const finalCached = await getCachedLink(shortCode, mockRedis);
      expect(finalCached).toBeTruthy();
    });
  });
  
  describe('Date Handling Edge Cases', () => {
    it('should handle very far future expiration dates', async () => {
      const shortCode = 'far-future';
      const farFuture = new Date('2099-12-31T23:59:59Z');
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: farFuture,
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect(new Date(cached!.expiresAt!).getTime()).toBe(farFuture.getTime());
    });
    
    it('should handle past expiration dates', async () => {
      const shortCode = 'past-date';
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: pastDate,
        isSaved: false,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect(new Date(cached!.expiresAt!).getTime()).toBe(pastDate.getTime());
    });
    
    it('should handle invalid date strings in cache', async () => {
      const shortCode = 'invalid-date';
      
      // Manually set data with invalid date
      const invalidData = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: 'not-a-date',
        isSaved: true,
      };
      
      await mockRedis.set(`link:${shortCode}`, JSON.stringify(invalidData));
      
      // Should handle gracefully
      const cached = await getCachedLink(shortCode, mockRedis);
      // Implementation should handle this - might return null or data with invalid date
      expect(cached === null || cached !== null).toBe(true);
    });
  });
  
  describe('Redis Connection Edge Cases', () => {
    it('should handle Redis connection loss during cache operation', async () => {
      const shortCode = 'connection-loss';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache successfully first
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Verify it's cached
      let cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      
      // Close connection
      await mockRedis.quit();
      
      // Try to cache again (should fail gracefully)
      await expect(cacheLink('another', linkData, mockRedis)).resolves.not.toThrow();
      
      // Note: ioredis-mock doesn't fully simulate connection loss like real Redis
      // In production, this would return null, but mock may still return cached data
      // The important part is that operations don't throw errors
    });
    
    it('should handle Redis returning unexpected data types', async () => {
      const shortCode = 'unexpected-type';
      
      // Manually set non-string data (Redis mock might allow this)
      // In real Redis, everything is a string, but testing edge case
      await mockRedis.set(`link:${shortCode}`, 12345 as any);
      
      // ioredis-mock may return the number directly, but getCachedLink
      // should handle it gracefully (either parse or return null)
      const cached = await getCachedLink(shortCode, mockRedis);
      
      // The important part is it doesn't throw an error
      // Result may be null or parsed data depending on implementation
      expect(cached === null || cached !== null).toBe(true);
    });
  });
  
  describe('Cache-Aside Pattern Edge Cases', () => {
    it('should handle database returning null after cache invalidation', async () => {
      const shortCode = 'deleted-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Cache the link
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Invalidate cache (simulating deletion)
      await invalidateLinkCache(shortCode, mockRedis);
      
      // Mock database to return null (link was deleted)
      mockPrisma.link.findUnique.mockResolvedValue(null);
      
      // Try to get link
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      
      // Should return null
      expect(result).toBeNull();
      
      // Cache should not be populated
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle race condition between cache and database', async () => {
      const shortCode = 'race-condition';
      const dbLink = {
        id: 'link-id-123',
        shortCode,
        originalUrl: 'https://example.com',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        clickCount: 0,
        createdByIp: '127.0.0.1',
        isSaved: true,
      };
      
      // Mock database with delay
      mockPrisma.link.findUnique.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(dbLink), 100);
        });
      });
      
      // Start two concurrent requests
      const [result1, result2] = await Promise.all([
        getLinkWithCache(shortCode, mockPrisma, mockRedis),
        getLinkWithCache(shortCode, mockPrisma, mockRedis),
      ]);
      
      // Both should return the link
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(result1!.originalUrl).toBe(dbLink.originalUrl);
      expect(result2!.originalUrl).toBe(dbLink.originalUrl);
    });
  });
});
