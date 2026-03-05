/**
 * Cache Manager
 * 
 * Provides Redis caching functions for link data with cache-aside pattern.
 * 
 * **Validates: Requirements 7.5, 7.6, 12.3**
 * 
 * Features:
 * - 1 hour TTL for cached links
 * - Cache-aside pattern for getLinkWithCache
 * - Graceful degradation on Redis connection failures
 * - Cache key format: link:{shortCode}
 * - Stores full Link object as JSON in cache
 */

import { PrismaClient, Link } from '@prisma/client';
import type { Redis } from 'ioredis';

/**
 * Cached link data structure
 * Subset of Link model stored in Redis
 */
export interface CachedLink {
  originalUrl: string;
  userId: string | null;
  expiresAt: Date | null;
  isSaved: boolean;
}

/**
 * Cache TTL in seconds (1 hour)
 * Validates: Requirement 7.6 (cache TTL to 1 hour for active links)
 */
const CACHE_TTL_SECONDS = 3600;

/**
 * Caches link data in Redis for fast redirects
 * 
 * **Validates: Requirement 7.5 (cache frequently accessed Short_Codes in Redis)**
 * **Validates: Requirement 7.6 (set cache TTL to 1 hour for active links)**
 * 
 * @param shortCode - The short code to cache
 * @param link - The link data to cache
 * @param redis - Redis client instance
 * @returns Promise that resolves when caching is complete
 */
export async function cacheLink(
  shortCode: string,
  link: CachedLink,
  redis: Redis | null
): Promise<void> {
  // If Redis is not available, skip caching
  if (!redis) {
    return;
  }
  
  try {
    const key = `link:${shortCode}`;
    const value = JSON.stringify(link);
    
    await redis.setex(key, CACHE_TTL_SECONDS, value);
  } catch (error) {
    // Graceful degradation: log error but don't throw
    // This allows the application to continue working even if Redis is down
    console.error(`Failed to cache link ${shortCode}:`, error);
  }
}

/**
 * Retrieves link from cache
 * 
 * **Validates: Requirement 7.5 (cache frequently accessed Short_Codes in Redis)**
 * 
 * @param shortCode - The short code to retrieve
 * @param redis - Redis client instance
 * @returns Promise that resolves to cached link data or null if not found
 */
export async function getCachedLink(
  shortCode: string,
  redis: Redis | null
): Promise<CachedLink | null> {
  // If Redis is not available, return null (cache miss)
  if (!redis) {
    return null;
  }
  
  try {
    const key = `link:${shortCode}`;
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }
    
    // Parse JSON and handle date conversion
    const parsed = JSON.parse(data);
    
    // Convert expiresAt string back to Date if present
    if (parsed.expiresAt) {
      parsed.expiresAt = new Date(parsed.expiresAt);
    }
    
    return parsed as CachedLink;
  } catch (error) {
    // Graceful degradation: return null on error
    console.error(`Failed to get cached link ${shortCode}:`, error);
    return null;
  }
}

/**
 * Invalidates link cache
 * 
 * **Validates: Requirement 7.7 (when a link is deleted, immediately invalidate its cache entry)**
 * 
 * @param shortCode - The short code to invalidate
 * @param redis - Redis client instance
 * @returns Promise that resolves when invalidation is complete
 */
export async function invalidateLinkCache(
  shortCode: string,
  redis: Redis | null
): Promise<void> {
  // If Redis is not available, skip invalidation
  if (!redis) {
    return;
  }
  
  try {
    const key = `link:${shortCode}`;
    await redis.del(key);
  } catch (error) {
    // Graceful degradation: log error but don't throw
    console.error(`Failed to invalidate cache for link ${shortCode}:`, error);
  }
}

/**
 * Retrieves link with cache-aside pattern
 * 
 * **Validates: Requirement 12.3 (cache frequently accessed links in Redis with 1-hour TTL)**
 * 
 * Algorithm:
 * 1. Try to get link from cache
 * 2. If cache hit, return cached data
 * 3. If cache miss, fetch from database
 * 4. If found in database, populate cache
 * 5. Return link data
 * 
 * @param shortCode - The short code to retrieve
 * @param prisma - Prisma client instance
 * @param redis - Redis client instance
 * @returns Promise that resolves to Link object or null if not found
 */
export async function getLinkWithCache(
  shortCode: string,
  prisma: PrismaClient,
  redis: Redis | null
): Promise<Link | null> {
  // Try cache first (only if Redis is available)
  const cached = redis ? await getCachedLink(shortCode, redis) : null;
  
  if (cached) {
    // Cache hit: reconstruct Link object
    // Note: We don't have all fields from cache, but we have the essential ones
    // The caller should be aware that some fields (id, createdAt, etc.) are not available
    return {
      shortCode,
      originalUrl: cached.originalUrl,
      userId: cached.userId,
      expiresAt: cached.expiresAt,
      isSaved: cached.isSaved,
      // These fields are not cached, but required by Link type
      // In practice, the redirect handler only needs the fields we cache
      id: '', // Not available from cache
      createdAt: new Date(), // Not available from cache
      updatedAt: new Date(), // Not available from cache
      clickCount: 0, // Not available from cache
      createdByIp: '', // Not available from cache
    } as Link;
  }
  
  // Cache miss: fetch from database
  try {
    const link = await prisma.link.findUnique({
      where: { shortCode },
    });
    
    if (link && redis) {
      // Populate cache for future requests (only if Redis is available)
      await cacheLink(
        shortCode,
        {
          originalUrl: link.originalUrl,
          userId: link.userId,
          expiresAt: link.expiresAt,
          isSaved: link.isSaved,
        },
        redis
      );
    }
    
    return link;
  } catch (error) {
    // Log database error and return null
    console.error(`Failed to fetch link ${shortCode} from database:`, error);
    return null;
  }
}
