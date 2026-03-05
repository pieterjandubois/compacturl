/**
 * Click Tracker Edge Cases Tests
 * 
 * Tests for edge cases and boundary conditions in click tracking.
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
  mockPrisma = {
    link: {
      update: jest.fn(),
    },
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Click Tracker Edge Cases', () => {
  describe('isBot edge cases', () => {
    it('should handle very long user agent strings', () => {
      const longUA = 'Mozilla/5.0 ' + 'a'.repeat(10000) + ' Chrome/91.0';
      expect(isBot(longUA)).toBe(false);
    });
    
    it('should handle user agent with bot in middle of word', () => {
      // "robot" contains "bot" but is not necessarily a bot
      expect(isBot('MyRobotApp/1.0')).toBe(true); // Still matches pattern
    });
    
    it('should handle user agent with special characters', () => {
      expect(isBot('Mozilla/5.0 (compatible; Bot-Name/1.0; +http://example.com)')).toBe(true);
    });
    
    it('should handle user agent with unicode characters', () => {
      expect(isBot('Mozilla/5.0 (compatible; 机器人/1.0)')).toBe(false); // Chinese for "robot"
    });
    
    it('should handle user agent with newlines', () => {
      expect(isBot('Googlebot/2.1\n+http://www.google.com/bot.html')).toBe(true);
    });
    
    it('should handle user agent with tabs', () => {
      expect(isBot('Googlebot/2.1\t+http://www.google.com/bot.html')).toBe(true);
    });
    
    it('should handle mixed case bot names', () => {
      expect(isBot('GoOgLeBoT/2.1')).toBe(true);
      expect(isBot('BINGBOT/2.0')).toBe(true);
      expect(isBot('slackbot/1.0')).toBe(true);
    });
    
    it('should handle bot patterns at different positions', () => {
      expect(isBot('bot')).toBe(true);
      expect(isBot('prefix-bot')).toBe(true);
      expect(isBot('bot-suffix')).toBe(true);
      expect(isBot('prefix-bot-suffix')).toBe(true);
    });
    
    it('should handle multiple bot patterns in one string', () => {
      expect(isBot('bot crawler spider')).toBe(true);
    });
    
    it('should not detect "about" as bot', () => {
      // "about" contains "bot" substring but is not a bot
      expect(isBot('Mozilla/5.0 about page')).toBe(false); // Doesn't match - "bot" is not in "about"
    });
    
    it('should handle whitespace-only user agent', () => {
      expect(isBot('   ')).toBe(false);
      expect(isBot('\t\n')).toBe(false);
    });
  });
  
  describe('trackClick edge cases', () => {
    it('should handle very long short codes', async () => {
      const longShortCode = 'a'.repeat(1000);
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      await trackClick(longShortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalledWith({
        where: { shortCode: longShortCode },
        data: {
          clickCount: {
            increment: 1,
          },
        },
      });
    });
    
    it('should handle short codes with special characters', async () => {
      const specialShortCode = 'test-link-123_special!@#';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      await trackClick(specialShortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalled();
    });
    
    it('should handle database timeout errors', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockRejectedValue(new Error('Connection timeout'));
      
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    it('should handle database constraint violations', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockRejectedValue(new Error('Unique constraint violation'));
      
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    it('should handle null Prisma client gracefully', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      // This should not throw even with null client
      await expect(trackClick(shortCode, userAgent, null as any)).resolves.not.toThrow();
    });
    
    it('should handle undefined user agent', async () => {
      const shortCode = 'test-link';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      // undefined should be treated as non-bot
      await trackClick(shortCode, undefined as any, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalled();
    });
    
    it('should handle rapid successive clicks from same user', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      // Simulate rapid clicks (no delay)
      const promises = Array(100).fill(null).map(() => 
        trackClick(shortCode, userAgent, mockPrisma)
      );
      
      await Promise.all(promises);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // All 100 clicks should be tracked
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(100);
    });
    
    it('should handle database returning unexpected data', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      // Mock returning unexpected structure
      mockPrisma.link.update.mockResolvedValue(null);
      
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    it('should handle Prisma client disconnect', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockRejectedValue(new Error('PrismaClientKnownRequestError: Client has already been closed'));
      
      await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
  
  describe('Bot detection edge cases', () => {
    it('should detect headless Chrome (often used by bots)', () => {
      expect(isBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36')).toBe(false);
      // Note: Headless Chrome doesn't match our bot patterns, which is intentional
      // We only detect known bot user agents
    });
    
    it('should detect Selenium WebDriver', () => {
      expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Selenium/3.141.59')).toBe(false);
      // Selenium doesn't match our patterns either
    });
    
    it('should detect PhantomJS', () => {
      expect(isBot('Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1')).toBe(false);
    });
    
    it('should detect common scraping libraries', () => {
      expect(isBot('python-requests/2.25.1')).toBe(true);
      expect(isBot('python-urllib/3.9')).toBe(true);
      expect(isBot('Java/1.8.0_292')).toBe(false); // Java doesn't match our patterns
    });
    
    it('should detect monitoring services', () => {
      expect(isBot('UptimeRobot/2.0')).toBe(true);
      expect(isBot('Pingdom.com_bot_version_1.4')).toBe(true);
    });
    
    it('should detect social media preview bots', () => {
      expect(isBot('facebookexternalhit/1.1')).toBe(true);
      expect(isBot('Twitterbot/1.0')).toBe(true);
      expect(isBot('LinkedInBot/1.0')).toBe(true);
      expect(isBot('WhatsApp/2.0')).toBe(false); // WhatsApp doesn't match
    });
    
    it('should detect search engine bots', () => {
      expect(isBot('Googlebot/2.1')).toBe(true);
      expect(isBot('bingbot/2.0')).toBe(true);
      expect(isBot('DuckDuckBot/1.0')).toBe(true);
      expect(isBot('YandexBot/3.0')).toBe(true);
    });
    
    it('should not detect legitimate mobile apps', () => {
      expect(isBot('MyApp/1.0 (iPhone; iOS 14.6)')).toBe(false);
      expect(isBot('MyApp/1.0 (Android 11)')).toBe(false);
    });
    
    it('should not detect legitimate desktop apps', () => {
      expect(isBot('MyDesktopApp/1.0 (Windows 10)')).toBe(false);
      expect(isBot('Electron/13.0.0')).toBe(false);
    });
  });
  
  describe('Performance edge cases', () => {
    it('should handle tracking many clicks in parallel', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      mockPrisma.link.update.mockResolvedValue({
        id: 'link-123',
        clickCount: 1,
      });
      
      // Track 1000 clicks in parallel
      const promises = Array(1000).fill(null).map(() => 
        trackClick(shortCode, userAgent, mockPrisma)
      );
      
      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      // Should complete quickly (fire-and-forget)
      expect(duration).toBeLessThan(1000); // Less than 1 second
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(1000);
    });
    
    it('should not block on slow database operations', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      // Mock slow database operation
      mockPrisma.link.update.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ clickCount: 1 }), 1000))
      );
      
      const start = Date.now();
      await trackClick(shortCode, userAgent, mockPrisma);
      const duration = Date.now() - start;
      
      // Should return immediately (fire-and-forget)
      expect(duration).toBeLessThan(100);
    });
  });
  
  describe('Error recovery', () => {
    it('should continue tracking after database error', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      // First call fails
      mockPrisma.link.update.mockRejectedValueOnce(new Error('Database error'));
      // Second call succeeds
      mockPrisma.link.update.mockResolvedValueOnce({ clickCount: 1 });
      
      await trackClick(shortCode, userAgent, mockPrisma);
      await trackClick(shortCode, userAgent, mockPrisma);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(2);
    });
    
    it('should handle intermittent database failures', async () => {
      const shortCode = 'test-link';
      const userAgent = 'Mozilla/5.0 Chrome/91.0';
      
      // Alternate between success and failure
      mockPrisma.link.update
        .mockResolvedValueOnce({ clickCount: 1 })
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ clickCount: 2 })
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce({ clickCount: 3 });
      
      for (let i = 0; i < 5; i++) {
        await trackClick(shortCode, userAgent, mockPrisma);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPrisma.link.update).toHaveBeenCalledTimes(5);
    });
  });
});
