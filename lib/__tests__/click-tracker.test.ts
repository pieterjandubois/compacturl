/**
 * Click Tracker Tests
 * 
 * Unit tests for click tracking and bot detection functions.
 * 
 * **Validates: Requirements 6.1, 6.4, 6.5**
 * 
 * Test-First Development:
 * 1. Write tests FIRST (this file)
 * 2. Validate tests fail appropriately
 * 3. Implement click tracker functions
 * 4. Verify tests pass
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { trackClick, isBot } from '../click-tracker';

// Mock Prisma client
let mockPrisma: any;

beforeEach(() => {
  // Create mock Prisma client
  mockPrisma = {
    link: {
      update: jest.fn(),
    },
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Click Tracker', () => {
  describe('isBot', () => {
    it('should detect Googlebot', () => {
      expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    });
    
    it('should detect Bingbot', () => {
      expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
    });
    
    it('should detect Slackbot', () => {
      expect(isBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(true);
    });
    
    it('should detect facebookexternalhit', () => {
      expect(isBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    });
    
    it('should detect Twitterbot', () => {
      expect(isBot('Twitterbot/1.0')).toBe(true);
    });
    
    it('should detect generic bot pattern', () => {
      expect(isBot('SomeBot/1.0')).toBe(true);
    });
    
    it('should detect crawler', () => {
      expect(isBot('Mozilla/5.0 (compatible; MyCrawler/1.0)')).toBe(true);
    });
    
    it('should detect spider', () => {
      expect(isBot('MySpider/1.0')).toBe(true);
    });
    
    it('should detect scraper', () => {
      expect(isBot('MyScraper/1.0')).toBe(true);
    });
    
    it('should detect curl', () => {
      expect(isBot('curl/7.64.1')).toBe(true);
    });
    
    it('should detect wget', () => {
      expect(isBot('Wget/1.20.3 (linux-gnu)')).toBe(true);
    });
    
    it('should detect python requests', () => {
      expect(isBot('python-requests/2.25.1')).toBe(true);
    });
    
    it('should be case-insensitive', () => {
      expect(isBot('GOOGLEBOT/2.1')).toBe(true);
      expect(isBot('googlebot/2.1')).toBe(true);
      expect(isBot('GoogleBot/2.1')).toBe(true);
    });
    
    it('should not detect regular Chrome browser', () => {
      expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')).toBe(false);
    });
    
    it('should not detect regular Firefox browser', () => {
      expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0')).toBe(false);
    });
    
    it('should not detect regular Safari browser', () => {
      expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15')).toBe(false);
    });
    
    it('should not detect mobile browsers', () => {
      expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1')).toBe(false);
    });
    
    it('should handle empty user agent', () => {
      expect(isBot('')).toBe(false);
    });
    
    it('should handle undefined-like strings', () => {
      expect(isBot('undefined')).toBe(false);
      expect(isBot('null')).toBe(false);
    });
  });
  
  describe('trackClick', () => {
    it('should increment click count for non-bot user agent', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        shortCode,
        clickCount: 1,
      });
      
      await trackClick(shortCode, userAgent, mockPrisma);
      
      // Wait a bit for async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalledWith({
        where: { shortCode },
        data: {
          clickCount: {
            increment: 1,
          },
        },
      });
    });
    
    it('should not increment click count for bot user agent', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Googlebot/2.1';
      
      await trackClick(shortCode, userAgent, mockPrisma);
      
      // Wait a bit to ensure no async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).not.toHaveBeenCalled();
    });
    
    it('should not increment click count for Slackbot', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Slackbot-LinkExpanding 1.0';
      
      await trackClick(shortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).not.toHaveBeenCalled();
    });
    
    it('should not increment click count for curl', async () => {
      const shortCode = 'test-link';
      const userAgent = 'curl/7.64.1';
      
      await trackClick(shortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).not.toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully (fire-and-forget)', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0';
      
      // Mock database error
      mockPrisma.link.update.mockRejectedValue(new Error('Database connection failed'));
      
      // Should not throw error (fire-and-forget)
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalled();
    });
    
    it('should handle non-existent link gracefully', async () => {
      const shortCode = 'nonexistent';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0';
      
      // Mock Prisma error for non-existent link
      mockPrisma.link.update.mockRejectedValue(new Error('Record not found'));
      
      // Should not throw error
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    it('should be truly async (fire-and-forget)', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0';
      
      // Create a promise that resolves after a delay
      let updateCalled = false;
      mockPrisma.link.update.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            updateCalled = true;
            resolve({ id: 'link-123', clickCount: 1 });
          }, 50);
        });
      });
      
      // Call trackClick
      await trackClick(shortCode, userAgent, mockPrisma);
      
      // Should return immediately (before update completes)
      expect(updateCalled).toBe(false);
      
      // Wait for update to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(updateCalled).toBe(true);
    });
    
    it('should handle empty user agent string', async () => {
      const shortCode = 'test-link';
      const userAgent = '';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      // Empty string is not a bot, should track
      await trackClick(shortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalled();
    });
    
    it('should handle multiple concurrent clicks', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      // Simulate multiple concurrent clicks
      await Promise.all([
        trackClick(shortCode, userAgent, mockPrisma),
        trackClick(shortCode, userAgent, mockPrisma),
        trackClick(shortCode, userAgent, mockPrisma),
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have been called 3 times
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('Integration scenarios', () => {
    it('should track clicks from different browsers correctly', async () => {
      const shortCode = 'test-link';
      const browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      ];
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      for (const browser of browsers) {
        await trackClick(shortCode, browser, mockPrisma);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(3);
    });
    
    it('should not track clicks from different bots', async () => {
      const shortCode = 'test-link';
      const bots = [
        'Googlebot/2.1',
        'bingbot/2.0',
        'Slackbot-LinkExpanding 1.0',
        'facebookexternalhit/1.1',
        'Twitterbot/1.0',
      ];
      
      for (const bot of bots) {
        await trackClick(shortCode, bot, mockPrisma);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).not.toHaveBeenCalled();
    });
    
    it('should handle mixed bot and non-bot traffic', async () => {
      const shortCode = 'test-link';
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0', // Real user
        'Googlebot/2.1', // Bot
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6) Safari/604.1', // Real user
        'Slackbot-LinkExpanding 1.0', // Bot
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Firefox/89.0', // Real user
      ];
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      for (const ua of userAgents) {
        await trackClick(shortCode, ua, mockPrisma);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should only track 3 real users (not 2 bots)
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(3);
    });
  });
});
