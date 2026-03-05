/**
 * Rate Limiter
 * 
 * Provides distributed rate limiting using Redis for both anonymous and registered users.
 * Falls back to in-memory rate limiting when Redis is not available.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.4, 10.5**
 * 
 * Features:
 * - Anonymous users: 40 requests per hour per IP
 * - Registered users: 100 requests per hour per account
 * - Distributed rate limiting via Redis INCR and EXPIRE
 * - In-memory fallback when Redis is unavailable
 * - Automatic counter reset after 1 hour
 * - Key format: ratelimit:{type}:{identifier}
 * 
 * Algorithm:
 * 1. Check current count from Redis (or in-memory store)
 * 2. If count >= limit, reject request
 * 3. If count < limit, increment counter
 * 4. Set expiration on first request (counter = 1)
 * 5. Return result with allowed, remaining, resetAt, limit
 */

import type { Redis } from 'ioredis';

/**
 * Rate limit result returned to caller
 */
export interface RateLimitResult {
  allowed: boolean;      // true if request is allowed
  remaining: number;     // requests remaining in current window
  resetAt: Date;         // when the counter resets
  limit: number;         // total limit for this user type
}

/**
 * Rate limit configuration for each user type
 */
interface RateLimitConfig {
  maxRequests: number;   // Maximum requests allowed
  windowMs: number;      // Time window in milliseconds
}

/**
 * In-memory rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

/**
 * In-memory rate limit store (fallback when Redis is unavailable)
 */
const inMemoryStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configurations
 * 
 * **Validates: Requirement 10.1** - Anonymous users: 40 per hour
 * **Validates: Requirement 10.2** - Registered users: 100 per hour
 */
const RATE_LIMITS: Record<'anonymous' | 'registered', RateLimitConfig> = {
  anonymous: {
    maxRequests: 40,
    windowMs: 3600000, // 1 hour in milliseconds
  },
  registered: {
    maxRequests: 100,
    windowMs: 3600000, // 1 hour in milliseconds
  },
};

/**
 * Checks rate limit using in-memory store (fallback)
 */
function checkRateLimitInMemory(
  identifier: string,
  type: 'anonymous' | 'registered'
): RateLimitResult {
  const config = RATE_LIMITS[type];
  
  // Validate config exists
  if (!config) {
    console.error(`Invalid rate limit type: ${type}. Must be 'anonymous' or 'registered'`);
    throw new Error(`Invalid rate limit type: ${type}`);
  }
  
  const key = `ratelimit:${type}:${identifier}`;
  
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  
  // Clean up expired entries
  if (entry && entry.resetAt.getTime() <= now) {
    inMemoryStore.delete(key);
  }
  
  const currentEntry = inMemoryStore.get(key);
  
  if (!currentEntry) {
    // First request in window
    const resetAt = new Date(now + config.windowMs);
    inMemoryStore.set(key, { count: 1, resetAt });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
      limit: config.maxRequests,
    };
  }
  
  // Check if limit exceeded
  if (currentEntry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentEntry.resetAt,
      limit: config.maxRequests,
    };
  }
  
  // Increment counter
  currentEntry.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - currentEntry.count,
    resetAt: currentEntry.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Checks rate limit for link creation
 * 
 * **Validates: Requirement 10.5** - Use Redis for rate limit tracking
 * **Validates: Requirement 10.4** - Reset rate limit counters every hour
 * 
 * @param identifier - IP address (anonymous) or user ID (registered)
 * @param type - User type: 'anonymous' or 'registered'
 * @param redis - Redis client instance (optional, falls back to in-memory if null)
 * @returns Promise that resolves to RateLimitResult
 * @throws Error if Redis operation fails
 */
export async function checkRateLimit(
  identifier: string,
  type: 'anonymous' | 'registered',
  redis: Redis | null
): Promise<RateLimitResult> {
  // Use in-memory fallback if Redis is not available
  if (!redis) {
    console.warn('Redis not available, using in-memory rate limiting');
    return checkRateLimitInMemory(identifier, type);
  }
  
  const config = RATE_LIMITS[type];
  const key = `ratelimit:${type}:${identifier}`;
  
  try {
    // Get current count
    const currentStr = await redis.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    
    // Check if NaN (invalid counter value)
    if (isNaN(current)) {
      throw new Error(`Invalid rate limit counter value: ${currentStr}`);
    }
    
    // Get TTL for resetAt calculation
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs));
    
    // Check if limit exceeded
    if (current >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: config.maxRequests,
      };
    }
    
    // Increment counter
    const newCount = await redis.incr(key);
    
    // Set expiration on first request
    if (newCount === 1) {
      await redis.expire(key, Math.floor(config.windowMs / 1000));
    }
    
    // Get updated TTL after increment
    const updatedTtl = await redis.ttl(key);
    const updatedResetAt = new Date(Date.now() + (updatedTtl > 0 ? updatedTtl * 1000 : config.windowMs));
    
    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAt: updatedResetAt,
      limit: config.maxRequests,
    };
  } catch (error) {
    // Fall back to in-memory on Redis error
    console.warn('Redis error, falling back to in-memory rate limiting:', error);
    return checkRateLimitInMemory(identifier, type);
  }
}
