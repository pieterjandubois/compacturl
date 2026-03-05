/**
 * Unit Tests for Rate Limiter
 * 
 * Tests rate limiting functionality with Redis for both anonymous and registered users.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.7**
 * 
 * Test Coverage:
 * - Anonymous user rate limit (40/hour)
 * - Registered user rate limit (100/hour)
 * - Rate limit reset after 1 hour
 * - Rate limit at exact boundary (40th/100th request)
 * - Concurrent requests
 */

import { Redis } from 'ioredis';
import { checkRateLimit } from '../rate-limiter';

// Mock Redis client
let mockRedis: jest.Mocked<Redis>;

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Create mock Redis client
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Anonymous User Rate Limiting', () => {
    const identifier = '192.168.1.1';
    const type = 'anonymous' as const;

    test('should allow first request', async () => {
      // Requirement 10.1: Limit Anonymous_Users to 40 link creations per hour per IP address
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39); // 40 - 1
      expect(result.limit).toBe(40);
      expect(mockRedis.get).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1');
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1');
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1', 3600);
    });

    test('should allow requests under limit', async () => {
      // Requirement 10.1: Limit Anonymous_Users to 40 link creations per hour per IP address
      mockRedis.get.mockResolvedValue('20');
      mockRedis.incr.mockResolvedValue(21);
      mockRedis.ttl.mockResolvedValue(1800); // 30 minutes remaining

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 40 - 21
      expect(result.limit).toBe(40);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    test('should allow exactly 40th request (boundary)', async () => {
      // Requirement 10.7: Test rate limit at exact boundary
      mockRedis.get.mockResolvedValue('39');
      mockRedis.incr.mockResolvedValue(40);
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 40 - 40
      expect(result.limit).toBe(40);
    });

    test('should reject 41st request (over limit)', async () => {
      // Requirement 10.3: When a rate limit is exceeded, return HTTP 429 status
      mockRedis.get.mockResolvedValue('40');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(40);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(mockRedis.incr).not.toHaveBeenCalled(); // Should not increment when over limit
    });

    test('should set expiration on first request', async () => {
      // Requirement 10.4: Reset rate limit counters every hour
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      await checkRateLimit(identifier, type, mockRedis);

      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1', 3600);
    });

    test('should not set expiration on subsequent requests', async () => {
      // Requirement 10.4: Expiration should only be set once
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.ttl.mockResolvedValue(3000);

      await checkRateLimit(identifier, type, mockRedis);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    test('should calculate correct resetAt time', async () => {
      // Requirement 10.7: Display the time until the limit resets
      const now = Date.now();
      const ttlSeconds = 1800; // 30 minutes
      
      mockRedis.get.mockResolvedValue('20');
      mockRedis.incr.mockResolvedValue(21);
      mockRedis.ttl.mockResolvedValue(ttlSeconds);

      const result = await checkRateLimit(identifier, type, mockRedis);

      const expectedResetAt = new Date(now + ttlSeconds * 1000);
      const actualResetAt = result.resetAt;
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(actualResetAt.getTime() - expectedResetAt.getTime())).toBeLessThan(1000);
    });
  });

  describe('Registered User Rate Limiting', () => {
    const identifier = 'user-123';
    const type = 'registered' as const;

    test('should allow first request', async () => {
      // Requirement 10.2: Limit Registered_Users to 100 link creations per hour per account
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // 100 - 1
      expect(result.limit).toBe(100);
      expect(mockRedis.get).toHaveBeenCalledWith('ratelimit:registered:user-123');
    });

    test('should allow requests under limit', async () => {
      // Requirement 10.2: Limit Registered_Users to 100 link creations per hour per account
      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 51
      expect(result.limit).toBe(100);
    });

    test('should allow exactly 100th request (boundary)', async () => {
      // Requirement 10.7: Test rate limit at exact boundary
      mockRedis.get.mockResolvedValue('99');
      mockRedis.incr.mockResolvedValue(100);
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 100 - 100
      expect(result.limit).toBe(100);
    });

    test('should reject 101st request (over limit)', async () => {
      // Requirement 10.3: When a rate limit is exceeded, return HTTP 429 status
      mockRedis.get.mockResolvedValue('100');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(100);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Reset', () => {
    test('should reset counter after TTL expires', async () => {
      // Requirement 10.4: Reset rate limit counters every hour
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // First request after reset (counter doesn't exist)
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39);
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1', 3600);
    });

    test('should provide correct resetAt when limit exceeded', async () => {
      // Requirement 10.7: Display the time until the limit resets
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;
      const ttlSeconds = 900; // 15 minutes remaining

      mockRedis.get.mockResolvedValue('40');
      mockRedis.ttl.mockResolvedValue(ttlSeconds);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBeInstanceOf(Date);
      
      const expectedResetTime = Date.now() + ttlSeconds * 1000;
      const actualResetTime = result.resetAt.getTime();
      
      // Allow 1 second tolerance
      expect(Math.abs(actualResetTime - expectedResetTime)).toBeLessThan(1000);
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle concurrent requests correctly', async () => {
      // Requirement 10.7: Test concurrent requests
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Simulate concurrent requests incrementing the counter
      let counter = 0;
      mockRedis.get.mockImplementation(async () => {
        return counter > 0 ? String(counter) : null;
      });
      mockRedis.incr.mockImplementation(async () => {
        counter++;
        return counter;
      });
      mockRedis.ttl.mockResolvedValue(3600);

      // Make 5 concurrent requests
      const promises = Array(5).fill(null).map(() => 
        checkRateLimit(identifier, type, mockRedis)
      );

      const results = await Promise.all(promises);

      // All should be allowed (under limit of 40)
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // Counter should be incremented 5 times
      expect(counter).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      // Graceful degradation: if Redis fails, we should handle it
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Should throw or handle gracefully depending on implementation
      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow();
    });

    test('should handle invalid counter values', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Invalid counter value (not a number)
      mockRedis.get.mockResolvedValue('invalid');
      mockRedis.ttl.mockResolvedValue(3600);

      // Should throw error for invalid counter value
      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow('Invalid rate limit counter value');
    });
  });

  describe('Key Format', () => {
    test('should use correct key format for anonymous users', async () => {
      // Requirement 10.5: Use Redis for rate limit tracking
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      await checkRateLimit(identifier, type, mockRedis);

      expect(mockRedis.get).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1');
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1');
    });

    test('should use correct key format for registered users', async () => {
      // Requirement 10.5: Use Redis for rate limit tracking
      const identifier = 'user-abc-123';
      const type = 'registered' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      await checkRateLimit(identifier, type, mockRedis);

      expect(mockRedis.get).toHaveBeenCalledWith('ratelimit:registered:user-abc-123');
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:registered:user-abc-123');
    });
  });
});
