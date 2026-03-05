/**
 * Unit tests for link expiration cleanup job
 * Tests expired link deletion, saved link preservation, cache invalidation, and batch processing
 */

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

describe('Expiration Cleanup Job', () => {
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  describe('cleanupExpiredLinks', () => {
    it('should delete expired links', async () => {
      const now = new Date();
      const expiredLinks = [
        { id: '1', shortCode: 'expired1', expiresAt: new Date(now.getTime() - 1000) },
        { id: '2', shortCode: 'expired2', expiresAt: new Date(now.getTime() - 2000) },
      ];

      prisma.link.findMany.mockResolvedValue(expiredLinks);
      prisma.link.deleteMany.mockResolvedValue({ count: 2 });

      const result = await cleanupExpiredLinks();

      expect(prisma.link.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        select: {
          id: true,
          shortCode: true,
        },
      });

      expect(prisma.link.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['1', '2'],
          },
        },
      });

      expect(result.deletedCount).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should not delete saved links (expiresAt = null)', async () => {
      prisma.link.findMany.mockResolvedValue([]);
      prisma.link.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredLinks();

      expect(prisma.link.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        select: {
          id: true,
          shortCode: true,
        },
      });

      expect(result.deletedCount).toBe(0);
    });

    it('should not delete non-expired links', async () => {
      prisma.link.findMany.mockResolvedValue([]);
      prisma.link.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredLinks();

      expect(result.deletedCount).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should invalidate cache for deleted links', async () => {
      const expiredLinks = [
        { id: '1', shortCode: 'expired1', expiresAt: new Date(Date.now() - 1000) },
        { id: '2', shortCode: 'expired2', expiresAt: new Date(Date.now() - 2000) },
      ];

      prisma.link.findMany.mockResolvedValue(expiredLinks);
      prisma.link.deleteMany.mockResolvedValue({ count: 2 });

      await cleanupExpiredLinks();

      expect(cache.invalidateLinkCache).toHaveBeenCalledTimes(2);
      expect(cache.invalidateLinkCache).toHaveBeenCalledWith('expired1');
      expect(cache.invalidateLinkCache).toHaveBeenCalledWith('expired2');
    });

    it('should process links in batches', async () => {
      // Create 150 expired links (should be processed in 2 batches of 100)
      const expiredLinks = Array.from({ length: 150 }, (_, i) => ({
        id: `${i + 1}`,
        shortCode: `expired${i + 1}`,
        expiresAt: new Date(Date.now() - 1000),
      }));

      prisma.link.findMany.mockResolvedValue(expiredLinks);
      prisma.link.deleteMany
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 50 });

      const result = await cleanupExpiredLinks();

      expect(prisma.link.deleteMany).toHaveBeenCalledTimes(2);
      expect(result.deletedCount).toBe(150);
      expect(result.batchCount).toBe(2);
    });

    it('should handle database errors gracefully', async () => {
      prisma.link.findMany.mockRejectedValue(new Error('Database error'));

      const result = await cleanupExpiredLinks();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.deletedCount).toBe(0);
    });

    it('should log cleanup results', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const expiredLinks = [
        { id: '1', shortCode: 'expired1', expiresAt: new Date(Date.now() - 1000) },
      ];

      prisma.link.findMany.mockResolvedValue(expiredLinks);
      prisma.link.deleteMany.mockResolvedValue({ count: 1 });

      await cleanupExpiredLinks();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup completed')
      );

      consoleSpy.mockRestore();
    });

    it('should return zero deleted count when no expired links found', async () => {
      prisma.link.findMany.mockResolvedValue([]);

      const result = await cleanupExpiredLinks();

      expect(result.deletedCount).toBe(0);
      expect(result.success).toBe(true);
      expect(prisma.link.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      const expiredLinks = [
        { id: '1', shortCode: 'expired1', expiresAt: new Date(Date.now() - 1000) },
      ];

      prisma.link.findMany.mockResolvedValue(expiredLinks);
      prisma.link.deleteMany.mockResolvedValue({ count: 1 });
      (cache.invalidateLinkCache as jest.Mock).mockRejectedValue(
        new Error('Cache error')
      );

      // Should not throw, just log the error
      const result = await cleanupExpiredLinks();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
    });

    it('should include timestamp in result', async () => {
      prisma.link.findMany.mockResolvedValue([]);

      const result = await cleanupExpiredLinks();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('sendExpirationWarnings', () => {
    let sendExpirationWarnings: any;

    beforeEach(async () => {
      // Import the function
      const module = await import('../expiration-cleanup');
      sendExpirationWarnings = module.sendExpirationWarnings;
    });

    it('should send warning emails for links expiring in 24 hours', async () => {
      const now = new Date();
      const expiresIn23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const expiringLinks = [
        {
          id: '1',
          shortCode: 'expiring1',
          originalUrl: 'https://example.com/1',
          expiresAt: expiresIn23Hours,
          userId: 'user1',
          user: {
            email: 'user1@example.com',
            name: 'User One',
          },
        },
      ];

      prisma.link.findMany.mockResolvedValue(expiringLinks);

      const result = await sendExpirationWarnings();

      expect(prisma.link.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          userId: {
            not: null,
          },
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1); // 1 email sent
    });

    it('should not send warnings for links without userId', async () => {
      const now = new Date();
      const expiresIn23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const expiringLinks = [
        {
          id: '1',
          shortCode: 'expiring1',
          originalUrl: 'https://example.com/1',
          expiresAt: expiresIn23Hours,
          userId: null, // Anonymous link
          user: null,
        },
      ];

      prisma.link.findMany.mockResolvedValue([]);

      const result = await sendExpirationWarnings();

      expect(result.deletedCount).toBe(0);
    });

    it('should not send warnings for links expiring after 24 hours', async () => {
      prisma.link.findMany.mockResolvedValue([]);

      const result = await sendExpirationWarnings();

      expect(result.deletedCount).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should handle email sending errors gracefully', async () => {
      const now = new Date();
      const expiresIn23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const expiringLinks = [
        {
          id: '1',
          shortCode: 'expiring1',
          originalUrl: 'https://example.com/1',
          expiresAt: expiresIn23Hours,
          userId: 'user1',
          user: {
            email: 'user1@example.com',
            name: 'User One',
          },
        },
      ];

      prisma.link.findMany.mockResolvedValue(expiringLinks);

      // Should not throw even if email fails
      const result = await sendExpirationWarnings();

      expect(result.success).toBe(true);
    });

    it('should send multiple warning emails', async () => {
      const now = new Date();
      const expiresIn23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const expiringLinks = [
        {
          id: '1',
          shortCode: 'expiring1',
          originalUrl: 'https://example.com/1',
          expiresAt: expiresIn23Hours,
          userId: 'user1',
          user: {
            email: 'user1@example.com',
            name: 'User One',
          },
        },
        {
          id: '2',
          shortCode: 'expiring2',
          originalUrl: 'https://example.com/2',
          expiresAt: expiresIn23Hours,
          userId: 'user2',
          user: {
            email: 'user2@example.com',
            name: 'User Two',
          },
        },
      ];

      prisma.link.findMany.mockResolvedValue(expiringLinks);

      const result = await sendExpirationWarnings();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2); // 2 emails sent
    });

    it('should handle database errors gracefully', async () => {
      prisma.link.findMany.mockRejectedValue(new Error('Database error'));

      const result = await sendExpirationWarnings();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.deletedCount).toBe(0);
    });

    it('should log warning email results', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const now = new Date();
      const expiresIn23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const expiringLinks = [
        {
          id: '1',
          shortCode: 'expiring1',
          originalUrl: 'https://example.com/1',
          expiresAt: expiresIn23Hours,
          userId: 'user1',
          user: {
            email: 'user1@example.com',
            name: 'User One',
          },
        },
      ];

      prisma.link.findMany.mockResolvedValue(expiringLinks);

      await sendExpirationWarnings();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning emails completed')
      );

      consoleSpy.mockRestore();
    });

    it('should return zero emails sent when no expiring links found', async () => {
      prisma.link.findMany.mockResolvedValue([]);

      const result = await sendExpirationWarnings();

      expect(result.deletedCount).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should include timestamp in result', async () => {
      prisma.link.findMany.mockResolvedValue([]);

      const result = await sendExpirationWarnings();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
