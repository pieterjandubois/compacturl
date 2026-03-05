/**
 * Property-Based Tests for Rate Limit Consistency
 * 
 * **Validates: Requirements 3.3, 5.12, 10.1, 10.2, 10.4, 10.6, 10.8**
 * **Property 4: Rate Limit Enforcement**
 * 
 * Tests rate limiting correctness using property-based testing:
 * - Counter increments correctly for multiple requests
 * - Limit enforcement at boundary (40th/100th request)
 * - Counter resets after window expires
 * - Remaining count is accurate
 * - ResetAt is in the future
 * - Rate limits apply correctly for anonymous vs registered users
 * 
 * Tag: Feature: compact-url, Property 4: Rate Limit Enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import Redis from 'ioredis-mock';
import { checkRateLimit, RateLimitResult } from '../rate-limiter';

// Mock Redis client
let mockRedis: Redis;

beforeEach(() => {
  // Create fresh mock Redis instance for each test
  mockRedis = new Redis();
});

afterEach(async () => {
  // Clean up Redis
  await mockRedis.flushall();
  await mockRedis.quit();
});

/**
 * Arbitrary generator for IP addresses (anonymous users)
 */
const ipAddressArbitrary = fc.ipV4();

/**
 * Arbitrary generator for user IDs (registered users)
 */
const userIdArbitrary = fc.uuid();

/**
 * Arbitrary generator for request counts (1-150 to test both limits)
 */
const requestCountArbitrary = fc.integer({ min: 1, max: 150 });

/**
 * Arbitrary generator for small request counts (1-10)
 */
const smallRequestCountArbitrary = fc.integer({ min: 1, max: 10 });

/**
 * Arbitrary generator for user type
 */
const userTypeArbitrary = fc.constantFrom('anonymous' as const, 'registered' as const);

describe('Property 4: Rate Limit Enforcement', () => {
  /**
   * Property 4.1: Counter increments monotonically
   * 
   * FOR ALL sequences of requests from the same identifier,
   * the counter SHALL increment by 1 for each request
   */
  it('Property 4.1: Counter increments monotonically', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        smallRequestCountArbitrary,
        async (identifier, requestCount) => {
          const type = 'anonymous' as const;
          let previousRemaining = 40; // Start with full limit
          
          for (let i = 0; i < requestCount; i++) {
            const result = await checkRateLimit(identifier, type, mockRedis);
            
            // Should be allowed (under limit)
            expect(result.allowed).toBe(true);
            
            // Remaining should decrease by 1 each time
            expect(result.remaining).toBe(previousRemaining - 1);
            
            previousRemaining = result.remaining;
          }
          
          // Final remaining should be initial limit minus request count
          expect(previousRemaining).toBe(40 - requestCount);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.2: Anonymous user limit enforcement at boundary
   * 
   * FOR ALL anonymous users, the 40th request SHALL be allowed,
   * and the 41st request SHALL be rejected
   */
  it('Property 4.2: Anonymous user limit enforcement at boundary', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        async (identifier) => {
          const type = 'anonymous' as const;
          const limit = 40;
          
          // Make exactly 40 requests
          for (let i = 0; i < limit; i++) {
            const result = await checkRateLimit(identifier, type, mockRedis);
            expect(result.allowed).toBe(true);
            expect(result.limit).toBe(limit);
          }
          
          // 41st request should be rejected
          const overLimitResult = await checkRateLimit(identifier, type, mockRedis);
          expect(overLimitResult.allowed).toBe(false);
          expect(overLimitResult.remaining).toBe(0);
          expect(overLimitResult.limit).toBe(limit);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.3: Registered user limit enforcement at boundary
   * 
   * FOR ALL registered users, the 100th request SHALL be allowed,
   * and the 101st request SHALL be rejected
   */
  it('Property 4.3: Registered user limit enforcement at boundary', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        async (identifier) => {
          const type = 'registered' as const;
          const limit = 100;
          
          // Make exactly 100 requests
          for (let i = 0; i < limit; i++) {
            const result = await checkRateLimit(identifier, type, mockRedis);
            expect(result.allowed).toBe(true);
            expect(result.limit).toBe(limit);
          }
          
          // 101st request should be rejected
          const overLimitResult = await checkRateLimit(identifier, type, mockRedis);
          expect(overLimitResult.allowed).toBe(false);
          expect(overLimitResult.remaining).toBe(0);
          expect(overLimitResult.limit).toBe(limit);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.4: Remaining count is accurate
   * 
   * FOR ALL requests, remaining count SHALL equal (limit - current_count)
   */
  it('Property 4.4: Remaining count is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        userTypeArbitrary,
        smallRequestCountArbitrary,
        async (identifier, type, requestCount) => {
          const limit = type === 'anonymous' ? 40 : 100;
          
          for (let i = 1; i <= requestCount; i++) {
            const result = await checkRateLimit(identifier, type, mockRedis);
            
            // Remaining should be limit - current count
            const expectedRemaining = limit - i;
            expect(result.remaining).toBe(expectedRemaining);
            expect(result.limit).toBe(limit);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.5: ResetAt is in the future
   * 
   * FOR ALL rate limit checks, resetAt SHALL be a future timestamp
   */
  it('Property 4.5: ResetAt is in the future', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        userTypeArbitrary,
        async (identifier, type) => {
          const now = Date.now();
          
          const result = await checkRateLimit(identifier, type, mockRedis);
          
          // ResetAt should be in the future
          expect(result.resetAt.getTime()).toBeGreaterThan(now);
          
          // ResetAt should be within 1 hour from now (3600 seconds)
          const oneHourFromNow = now + 3600 * 1000;
          expect(result.resetAt.getTime()).toBeLessThanOrEqual(oneHourFromNow + 1000); // +1s tolerance
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.6: Counter resets after window
   * 
   * FOR ALL users, after the rate limit window expires,
   * the counter SHALL reset to 0 and allow new requests
   */
  it('Property 4.6: Counter resets after window', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        async (identifier) => {
          const type = 'anonymous' as const;
          
          // Make some requests
          await checkRateLimit(identifier, type, mockRedis);
          await checkRateLimit(identifier, type, mockRedis);
          await checkRateLimit(identifier, type, mockRedis);
          
          // Verify counter is at 3
          const beforeReset = await checkRateLimit(identifier, type, mockRedis);
          expect(beforeReset.remaining).toBe(36); // 40 - 4
          
          // Simulate window expiration by deleting the key
          const key = `ratelimit:${type}:${identifier}`;
          await mockRedis.del(key);
          
          // Next request should start fresh
          const afterReset = await checkRateLimit(identifier, type, mockRedis);
          expect(afterReset.allowed).toBe(true);
          expect(afterReset.remaining).toBe(39); // 40 - 1 (fresh counter)
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.7: Different identifiers have independent counters
   * 
   * FOR ALL pairs of different identifiers, their rate limit counters
   * SHALL be independent and not affect each other
   */
  it('Property 4.7: Different identifiers have independent counters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(ipAddressArbitrary, ipAddressArbitrary).filter(([ip1, ip2]) => ip1 !== ip2),
        smallRequestCountArbitrary,
        async ([identifier1, identifier2], requestCount) => {
          const type = 'anonymous' as const;
          
          // Make requests from identifier1
          for (let i = 0; i < requestCount; i++) {
            await checkRateLimit(identifier1, type, mockRedis);
          }
          
          // Check identifier1's remaining
          const result1 = await checkRateLimit(identifier1, type, mockRedis);
          expect(result1.remaining).toBe(40 - requestCount - 1);
          
          // Check identifier2's remaining (should be fresh)
          const result2 = await checkRateLimit(identifier2, type, mockRedis);
          expect(result2.remaining).toBe(39); // 40 - 1 (first request)
          expect(result2.allowed).toBe(true);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.8: Anonymous and registered limits are different
   * 
   * FOR ALL identifiers, anonymous users SHALL have a limit of 40,
   * and registered users SHALL have a limit of 100
   */
  it('Property 4.8: Anonymous and registered limits are different', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        async (identifier) => {
          // Check anonymous limit
          const anonymousResult = await checkRateLimit(identifier, 'anonymous', mockRedis);
          expect(anonymousResult.limit).toBe(40);
          expect(anonymousResult.remaining).toBe(39); // 40 - 1
          
          // Clean up
          await mockRedis.del(`ratelimit:anonymous:${identifier}`);
          
          // Check registered limit (different key, so independent)
          const registeredResult = await checkRateLimit(identifier, 'registered', mockRedis);
          expect(registeredResult.limit).toBe(100);
          expect(registeredResult.remaining).toBe(99); // 100 - 1
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.9: Limit enforcement is consistent across multiple checks
   * 
   * FOR ALL users at the limit, repeated checks SHALL consistently
   * return allowed=false without incrementing the counter
   */
  it('Property 4.9: Limit enforcement is consistent across multiple checks', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        fc.integer({ min: 1, max: 5 }),
        async (identifier, extraChecks) => {
          const type = 'anonymous' as const;
          const limit = 40;
          
          // Reach the limit
          for (let i = 0; i < limit; i++) {
            await checkRateLimit(identifier, type, mockRedis);
          }
          
          // Make multiple checks over the limit
          for (let i = 0; i < extraChecks; i++) {
            const result = await checkRateLimit(identifier, type, mockRedis);
            
            // Should consistently reject
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.limit).toBe(limit);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.10: Rate limit enforces limit consistently
   * 
   * FOR ALL users, when at or over the limit, the allowed flag
   * SHALL be false, and when under the limit, it SHALL be true
   */
  it('Property 4.10: Rate limit enforces limit consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        userTypeArbitrary,
        fc.integer({ min: 0, max: 150 }),
        async (identifier, type, initialCount) => {
          const limit = type === 'anonymous' ? 40 : 100;
          const key = `ratelimit:${type}:${identifier}`;
          
          // Set initial counter state
          if (initialCount > 0) {
            await mockRedis.set(key, initialCount.toString());
            await mockRedis.expire(key, 3600);
          }
          
          // Check rate limit
          const result = await checkRateLimit(identifier, type, mockRedis);
          
          // Verify consistency: if counter was at or over limit, should be rejected
          if (initialCount >= limit) {
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          } else {
            // Under limit, should be allowed
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limit - initialCount - 1);
          }
          
          expect(result.limit).toBe(limit);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.11: Concurrent requests maintain counter accuracy
   * 
   * FOR ALL users, concurrent requests SHALL accurately increment
   * the counter without race conditions
   */
  it('Property 4.11: Concurrent requests maintain counter accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        fc.integer({ min: 2, max: 10 }),
        async (identifier, concurrentCount) => {
          const type = 'anonymous' as const;
          
          // Make concurrent requests
          const promises = Array(concurrentCount)
            .fill(null)
            .map(() => checkRateLimit(identifier, type, mockRedis));
          
          const results = await Promise.all(promises);
          
          // All should be allowed (under limit of 40)
          results.forEach((result) => {
            expect(result.allowed).toBe(true);
            expect(result.limit).toBe(40);
          });
          
          // Check final counter state
          const finalResult = await checkRateLimit(identifier, type, mockRedis);
          
          // Remaining should account for all concurrent requests + 1 final check
          expect(finalResult.remaining).toBe(40 - concurrentCount - 1);
        }
      ),
      { numRuns: 25 }
    );
  });
  
  /**
   * Property 4.12: Rate limit applies to link creation only
   * 
   * This property documents that rate limits apply to link creation,
   * not to redirects or other operations (tested via integration tests)
   */
  it('Property 4.12: Rate limit key format is correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        userTypeArbitrary,
        async (identifier, type) => {
          // Clean up any existing key first to ensure fresh state
          const expectedKey = `ratelimit:${type}:${identifier}`;
          await mockRedis.del(expectedKey);
          
          await checkRateLimit(identifier, type, mockRedis);
          
          // Verify key format in Redis
          const value = await mockRedis.get(expectedKey);
          
          expect(value).not.toBeNull();
          expect(parseInt(value!, 10)).toBe(1);
        }
      ),
      { numRuns: 25 }
    );
  });
});
