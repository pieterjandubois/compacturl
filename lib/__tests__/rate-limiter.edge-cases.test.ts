/**
 * Edge Case Tests for Rate Limiter
 * 
 * Tests edge cases and error conditions for rate limiting functionality.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.7**
 * 
 * Test Coverage:
 * - Very long identifiers (IP addresses, user IDs)
 * - Special characters in identifiers
 * - Empty/null identifiers (error handling)
 * - Negative counter values (corruption recovery)
 * - Very large counter values
 * - TTL edge cases (0, negative, very large)
 * - Redis returning unexpected data types
 * - Redis key expiring mid-operation
 * - Multiple users hitting limit simultaneously
 * - Rate limit recovery after Redis restart
 */

import { Redis } from 'ioredis';
import { checkRateLimit } from '../rate-limiter';

// Mock Redis client
let mockRedis: jest.Mocked<Redis>;

describe('Rate Limiter - Edge Cases', () => {
  beforeEach(() => {
    // Create mock Redis client
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      del: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Identifier Edge Cases', () => {
    test('should handle very long IP addresses (IPv6)', async () => {
      // IPv6 addresses can be very long
      const longIpv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(longIpv6, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39);
      expect(mockRedis.get).toHaveBeenCalledWith(`ratelimit:anonymous:${longIpv6}`);
    });

    test('should handle very long user IDs (UUIDs)', async () => {
      // UUIDs are 36 characters long
      const longUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const type = 'registered' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(longUserId, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(mockRedis.get).toHaveBeenCalledWith(`ratelimit:registered:${longUserId}`);
    });

    test('should handle identifiers with special characters', async () => {
      // Some systems might use special characters in identifiers
      const specialId = 'user@domain.com';
      const type = 'registered' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(specialId, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(mockRedis.get).toHaveBeenCalledWith(`ratelimit:registered:${specialId}`);
    });

    test('should handle identifiers with colons (IPv6 format)', async () => {
      const ipv6WithColons = '::1'; // localhost in IPv6
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(ipv6WithColons, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39);
    });

    test('should handle empty string identifier', async () => {
      const emptyId = '';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      // Should still work (Redis allows empty string keys)
      const result = await checkRateLimit(emptyId, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('ratelimit:anonymous:');
    });
  });

  describe('Counter Value Edge Cases', () => {
    test('should handle negative counter values (corruption recovery)', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Corrupted counter with negative value
      mockRedis.get.mockResolvedValue('-5');
      mockRedis.incr.mockResolvedValue(-4);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      // Should allow request (negative is under limit)
      expect(result.allowed).toBe(true);
      // Remaining calculation: 40 - (-4) = 44
      expect(result.remaining).toBe(44);
    });

    test('should handle very large counter values', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Counter way over limit
      mockRedis.get.mockResolvedValue('999999');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    test('should handle counter at maximum safe integer', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // JavaScript's MAX_SAFE_INTEGER
      const maxSafeInt = Number.MAX_SAFE_INTEGER.toString();
      mockRedis.get.mockResolvedValue(maxSafeInt);
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should handle counter value of zero', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Counter exists but is zero (unusual but possible)
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39); // 40 - 1
    });

    test('should handle non-numeric counter values', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Corrupted counter with non-numeric value
      mockRedis.get.mockResolvedValue('not-a-number');
      mockRedis.ttl.mockResolvedValue(3600);

      // Should throw error for invalid counter
      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Invalid rate limit counter value'
      );
    });

    test('should handle counter with leading zeros', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Counter with leading zeros
      mockRedis.get.mockResolvedValue('005');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(34); // 40 - 6
    });

    test('should handle counter with whitespace', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Counter with whitespace (parseInt should handle this)
      mockRedis.get.mockResolvedValue('  10  ');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29); // 40 - 11
    });
  });

  describe('TTL Edge Cases', () => {
    test('should handle TTL of zero (key about to expire)', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(0); // About to expire

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      // When TTL is 0, the implementation uses default window (3600000ms)
      // This is because TTL <= 0 means key is expiring/expired, so we use default
      const expectedResetAt = Date.now() + 3600000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });

    test('should handle negative TTL (key expired)', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(-1); // Key has no expiration

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      // Should use default window (1 hour)
      const expectedResetAt = Date.now() + 3600000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });

    test('should handle very large TTL', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      // Very large TTL (shouldn't happen in practice)
      const largeTtl = 999999;
      mockRedis.ttl.mockResolvedValue(largeTtl);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.resetAt).toBeInstanceOf(Date);
      // ResetAt should be far in the future (within 1 second tolerance)
      const expectedResetAt = Date.now() + largeTtl * 1000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });

    test('should handle TTL of -2 (key does not exist)', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Key doesn't exist
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(-2); // Key doesn't exist

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      // Should use default window
      const expectedResetAt = Date.now() + 3600000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });
  });

  describe('Redis Operation Edge Cases', () => {
    test('should handle Redis GET returning unexpected data type', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Redis returns object instead of string (shouldn't happen but test it)
      mockRedis.get.mockResolvedValue({ count: 5 } as any);
      mockRedis.ttl.mockResolvedValue(3600);

      // Should throw error for invalid counter
      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow();
    });

    test('should handle Redis INCR returning unexpected value', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      // INCR returns non-numeric value (shouldn't happen)
      mockRedis.incr.mockResolvedValue('invalid' as any);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      // Should handle gracefully (parseInt will return NaN, but we use the value directly)
      expect(result.allowed).toBe(true);
    });

    test('should handle Redis GET timeout', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockRejectedValue(new Error('Connection timeout'));

      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Rate limit check failed'
      );
    });

    test('should handle Redis INCR failure', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockRejectedValue(new Error('INCR failed'));
      mockRedis.ttl.mockResolvedValue(3600);

      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Rate limit check failed'
      );
    });

    test('should handle Redis EXPIRE failure', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockRejectedValue(new Error('EXPIRE failed'));
      mockRedis.ttl.mockResolvedValue(3600);

      // EXPIRE failure should propagate
      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Rate limit check failed'
      );
    });

    test('should handle Redis TTL failure', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.ttl.mockRejectedValue(new Error('TTL failed'));

      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Rate limit check failed'
      );
    });

    test('should handle Redis connection lost mid-operation', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // GET succeeds, but INCR fails due to connection loss
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockRejectedValue(new Error('Connection lost'));
      mockRedis.ttl.mockResolvedValue(3600);

      await expect(checkRateLimit(identifier, type, mockRedis)).rejects.toThrow(
        'Rate limit check failed'
      );
    });
  });

  describe('Key Expiration Edge Cases', () => {
    test('should handle key expiring between GET and INCR', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // GET returns value, but key expires before INCR
      mockRedis.get.mockResolvedValue('39');
      // INCR creates new key starting at 1
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      // Should allow (new counter)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39); // 40 - 1
      // Should set expiration since counter is 1
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    test('should handle key expiring between INCR and TTL', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      // TTL returns -2 (key doesn't exist anymore)
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      // Should use default window for resetAt
      const expectedResetAt = Date.now() + 3600000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });
  });

  describe('Multiple Users Edge Cases', () => {
    test('should handle multiple users hitting limit simultaneously', async () => {
      const type = 'anonymous' as const;
      const users = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];

      // Mock implementation that returns different values for different users
      mockRedis.get.mockImplementation(async (key: string) => {
        // All users are at limit
        return '40';
      });
      mockRedis.ttl.mockResolvedValue(1800);

      // Check all users simultaneously
      const promises = users.map((user) => checkRateLimit(user, type, mockRedis));
      const results = await Promise.all(promises);

      // All should be rejected
      results.forEach((result) => {
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(40);
      });

      // Verify INCR was not called for any user (all at limit)
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    test('should handle one user at limit while others are not', async () => {
      const type = 'anonymous' as const;
      const userAtLimit = '192.168.1.1';
      const userUnderLimit = '192.168.1.2';

      mockRedis.get.mockImplementation(async (key) => {
        if (key.includes(userAtLimit)) {
          return '40';
        }
        return '10';
      });
      mockRedis.incr.mockImplementation(async (key) => {
        if (key.includes(userAtLimit)) {
          return 41;
        }
        return 11;
      });
      mockRedis.ttl.mockResolvedValue(1800);

      const result1 = await checkRateLimit(userAtLimit, type, mockRedis);
      const result2 = await checkRateLimit(userUnderLimit, type, mockRedis);

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Rate Limit Recovery', () => {
    test('should recover after Redis restart (no existing keys)', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Simulate Redis restart - all keys gone
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await checkRateLimit(identifier, type, mockRedis);

      // Should start fresh
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39);
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:anonymous:192.168.1.1', 3600);
    });

    test('should handle partial data after Redis restart', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Counter exists but no TTL (shouldn't happen but test it)
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(-1); // No expiration set

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      // Should use default window
      const expectedResetAt = Date.now() + 3600000;
      expect(Math.abs(result.resetAt.getTime() - expectedResetAt)).toBeLessThan(1000);
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle exactly at limit for anonymous users', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // Exactly at limit (40)
      mockRedis.get.mockResolvedValue('40');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(40);
    });

    test('should handle exactly at limit for registered users', async () => {
      const identifier = 'user-123';
      const type = 'registered' as const;

      // Exactly at limit (100)
      mockRedis.get.mockResolvedValue('100');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(100);
    });

    test('should handle one below limit', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // One below limit (39)
      mockRedis.get.mockResolvedValue('39');
      mockRedis.incr.mockResolvedValue(40);
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 40 - 40
      expect(result.limit).toBe(40);
    });

    test('should handle one over limit', async () => {
      const identifier = '192.168.1.1';
      const type = 'anonymous' as const;

      // One over limit (41)
      mockRedis.get.mockResolvedValue('41');
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await checkRateLimit(identifier, type, mockRedis);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(40);
    });
  });
});
