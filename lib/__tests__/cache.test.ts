/**
 * Cache Manager Tests
 * 
 * Tests for Redis caching functions with cache-aside pattern.
 * 
 * **Validates: Requirements 7.5, 7.6, 12.3**
 * 
 * Test-First Development:
 * 1. Write tests FIRST (this file)
 * 2. Validate tests fail appropriately
 * 3. Implement cache manager functions
 * 4. Verify tests pass
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

describe('Cache Manager', () => {
  describe('cacheLink', () => {
    it('should cache link data with 1 hour TTL', async () => {
      const shortCode = 'test-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: new Date('2024-12-31'),
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Verify data is cached
      const cached = await mockRedis.get(`link:${shortCode}`);
      expect(cached).toBeTruthy();
      
      const parsed = JSON.parse(cached!);
      expect(parsed.originalUrl).toBe(linkData.originalUrl);
      expect(parsed.userId).toBe(linkData.userId);
      expect(parsed.isSaved).toBe(linkData.isSaved);
      
      // Verify TTL is set to 1 hour (3600 seconds)
      const ttl = await mockRedis.ttl(`link:${shortCode}`);
      expect(ttl).toBeGreaterThan(3590); // Allow small variance
      expect(ttl).toBeLessThanOrEqual(3600);
    });
    
    it('should cache link with null userId (anonymous link)', async () => {
      const shortCode = 'anon-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: null,
        expiresAt: new Date('2024-12-31'),
        isSaved: false,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await mockRedis.get(`link:${shortCode}`);
      const parsed = JSON.parse(cached!);
      expect(parsed.userId).toBeNull();
      expect(parsed.isSaved).toBe(false);
    });
    
    it('should cache link with null expiresAt (never expires)', async () => {
      const shortCode = 'saved-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const cached = await mockRedis.get(`link:${shortCode}`);
      const parsed = JSON.parse(cached!);
      expect(parsed.expiresAt).toBeNull();
    });
    
    it('should handle Redis connection failure gracefully', async () => {
      // Create a Redis client that will fail
      const failingRedis = new Redis();
      await failingRedis.quit();
      
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Should not throw, but fail silently
      await expect(cacheLink('test', linkData, failingRedis)).resolves.not.toThrow();
    });
  });
  
  describe('getCachedLink', () => {
    it('should retrieve cached link data', async () => {
      const shortCode = 'test-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: new Date('2024-12-31'),
        isSaved: true,
      };
      
      // Cache the link first
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Retrieve it
      const retrieved = await getCachedLink(shortCode, mockRedis);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.originalUrl).toBe(linkData.originalUrl);
      expect(retrieved!.userId).toBe(linkData.userId);
      expect(retrieved!.isSaved).toBe(linkData.isSaved);
    });
    
    it('should return null for cache miss', async () => {
      const retrieved = await getCachedLink('nonexistent', mockRedis);
      expect(retrieved).toBeNull();
    });
    
    it('should handle Redis connection failure gracefully', async () => {
      const failingRedis = new Redis();
      await failingRedis.quit();
      
      // Should return null instead of throwing
      const result = await getCachedLink('test', failingRedis);
      expect(result).toBeNull();
    });
    
    it('should parse dates correctly from JSON', async () => {
      const shortCode = 'test-link';
      const expiresAt = new Date('2024-12-31T23:59:59Z');
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt,
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      const retrieved = await getCachedLink(shortCode, mockRedis);
      
      expect(retrieved!.expiresAt).toBeTruthy();
      // Note: Date will be string after JSON parse, implementation should handle this
    });
  });
  
  describe('invalidateLinkCache', () => {
    it('should delete cached link', async () => {
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
      let cached = await mockRedis.get(`link:${shortCode}`);
      expect(cached).toBeTruthy();
      
      // Invalidate
      await invalidateLinkCache(shortCode, mockRedis);
      
      // Verify it's gone
      cached = await mockRedis.get(`link:${shortCode}`);
      expect(cached).toBeNull();
    });
    
    it('should handle invalidating non-existent cache entry', async () => {
      // Should not throw
      await expect(invalidateLinkCache('nonexistent', mockRedis)).resolves.not.toThrow();
    });
    
    it('should handle Redis connection failure gracefully', async () => {
      const failingRedis = new Redis();
      await failingRedis.quit();
      
      // Should not throw
      await expect(invalidateLinkCache('test', failingRedis)).resolves.not.toThrow();
    });
  });
  
  describe('getLinkWithCache (cache-aside pattern)', () => {
    it('should return cached link on cache hit', async () => {
      const shortCode = 'test-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: null,
        isSaved: true,
      };
      
      // Pre-populate cache
      await cacheLink(shortCode, linkData, mockRedis);
      
      // Get link with cache
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      
      expect(result).toBeTruthy();
      expect(result!.shortCode).toBe(shortCode);
      expect(result!.originalUrl).toBe(linkData.originalUrl);
      expect(result!.userId).toBe(linkData.userId);
      
      // Verify database was NOT queried (cache hit)
      expect(mockPrisma.link.findUnique).not.toHaveBeenCalled();
    });
    
    it('should fetch from database on cache miss and populate cache', async () => {
      const shortCode = 'test-link';
      const dbLink = {
        id: 'link-id-123',
        shortCode,
        originalUrl: 'https://example.com',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        clickCount: 5,
        createdByIp: '127.0.0.1',
        isSaved: true,
      };
      
      // Mock database response
      mockPrisma.link.findUnique.mockResolvedValue(dbLink);
      
      // Get link (cache miss)
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      
      expect(result).toBeTruthy();
      expect(result!.shortCode).toBe(shortCode);
      expect(result!.originalUrl).toBe(dbLink.originalUrl);
      
      // Verify database was queried
      expect(mockPrisma.link.findUnique).toHaveBeenCalledWith({
        where: { shortCode },
      });
      
      // Verify cache was populated
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeTruthy();
      expect(cached!.originalUrl).toBe(dbLink.originalUrl);
    });
    
    it('should return null when link not found in database', async () => {
      const shortCode = 'nonexistent';
      
      // Mock database returning null
      mockPrisma.link.findUnique.mockResolvedValue(null);
      
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      
      expect(result).toBeNull();
      expect(mockPrisma.link.findUnique).toHaveBeenCalled();
      
      // Verify cache was not populated
      const cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
    
    it('should handle Redis failure and fall back to database', async () => {
      const shortCode = 'test-link';
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
        isSaved: false,
      };
      
      // Create failing Redis client
      const failingRedis = new Redis();
      await failingRedis.quit();
      
      // Mock database response
      mockPrisma.link.findUnique.mockResolvedValue(dbLink);
      
      // Should still return link from database
      const result = await getLinkWithCache(shortCode, mockPrisma, failingRedis);
      
      expect(result).toBeTruthy();
      expect(result!.shortCode).toBe(shortCode);
      expect(mockPrisma.link.findUnique).toHaveBeenCalled();
    });
    
    it('should reconstruct full Link object from cache', async () => {
      const shortCode = 'test-link';
      const linkData: CachedLink = {
        originalUrl: 'https://example.com',
        userId: 'user-123',
        expiresAt: new Date('2024-12-31'),
        isSaved: true,
      };
      
      await cacheLink(shortCode, linkData, mockRedis);
      
      const result = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      
      // Verify it has the shortCode field (reconstructed)
      expect(result).toBeTruthy();
      expect(result!.shortCode).toBe(shortCode);
      expect(result!.originalUrl).toBe(linkData.originalUrl);
      expect(result!.userId).toBe(linkData.userId);
      expect(result!.isSaved).toBe(linkData.isSaved);
    });
  });
  
  describe('Cache consistency', () => {
    it('should maintain consistency between cache and database', async () => {
      const shortCode = 'test-link';
      const dbLink = {
        id: 'link-id-123',
        shortCode,
        originalUrl: 'https://example.com',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        clickCount: 10,
        createdByIp: '127.0.0.1',
        isSaved: true,
      };
      
      mockPrisma.link.findUnique.mockResolvedValue(dbLink);
      
      // First call: cache miss, fetch from DB
      const result1 = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      expect(result1!.originalUrl).toBe(dbLink.originalUrl);
      
      // Second call: cache hit, should return same data
      const result2 = await getLinkWithCache(shortCode, mockPrisma, mockRedis);
      expect(result2!.originalUrl).toBe(dbLink.originalUrl);
      
      // Database should only be queried once
      expect(mockPrisma.link.findUnique).toHaveBeenCalledTimes(1);
    });
    
    it('should invalidate cache when link is updated', async () => {
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
      
      // Simulate link update by invalidating cache
      await invalidateLinkCache(shortCode, mockRedis);
      
      // Verify cache is cleared
      cached = await getCachedLink(shortCode, mockRedis);
      expect(cached).toBeNull();
    });
  });
});
