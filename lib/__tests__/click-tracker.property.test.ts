/**
 * Click Tracker Property-Based Tests
 * 
 * Property-based tests for click tracking using fast-check.
 * 
 * **Validates: Requirements 6.1, 6.4, 6.5**
 * **Validates: Property 4 - Click Count Monotonicity**
 * 
 * Test-First Development:
 * 1. Write tests FIRST (this file)
 * 2. Validate tests fail appropriately
 * 3. Implement click tracker functions
 * 4. Verify tests pass
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { trackClick, isBot } from '../click-tracker';

// Mock Prisma client
let mockPrisma: any;

// Helper to generate non-empty, non-whitespace strings
const nonEmptyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

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

describe('Click Tracker Property-Based Tests', () => {
  describe('isBot properties', () => {
    it('Property: isBot is deterministic - same input always produces same output', () => {
      fc.assert(
        fc.property(fc.string(), (userAgent) => {
          const result1 = isBot(userAgent);
          const result2 = isBot(userAgent);
          const result3 = isBot(userAgent);
          
          return result1 === result2 && result2 === result3;
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property: isBot returns boolean for all inputs', () => {
      fc.assert(
        fc.property(fc.string(), (userAgent) => {
          const result = isBot(userAgent);
          return typeof result === 'boolean';
        }),
        { numRuns: 50 }
      );
    });
    
    it('Property: isBot is case-insensitive for bot patterns', () => {
      const botKeywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...botKeywords),
          fc.string(),
          fc.string(),
          (keyword, prefix, suffix) => {
            const lowercase = `${prefix}${keyword}${suffix}`;
            const uppercase = `${prefix}${keyword.toUpperCase()}${suffix}`;
            const mixedcase = `${prefix}${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}${suffix}`;
            
            const result1 = isBot(lowercase);
            const result2 = isBot(uppercase);
            const result3 = isBot(mixedcase);
            
            // All should return the same result (case-insensitive)
            return result1 === result2 && result2 === result3;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: Known bot patterns always detected', () => {
      const knownBots = [
        'Googlebot',
        'bingbot',
        'Slackbot',
        'facebookexternalhit',
        'Twitterbot',
        'crawler',
        'spider',
        'scraper',
        'curl',
        'wget',
        'python-requests',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...knownBots),
          fc.string(),
          fc.string(),
          (botName, prefix, suffix) => {
            const userAgent = `${prefix}${botName}${suffix}`;
            return isBot(userAgent) === true;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: Known browser patterns never detected as bots', () => {
      const knownBrowsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...knownBrowsers),
          (userAgent) => {
            return isBot(userAgent) === false;
          }
        ),
        { numRuns: 25 }
      );
    });
  });
  
  describe('trackClick properties', () => {
    it('Property: trackClick never throws for any input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.string(),
          async (shortCode, userAgent) => {
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            // Should never throw
            await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: trackClick never throws even on database errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.string(),
          fc.constantFrom(
            new Error('Connection failed'),
            new Error('Timeout'),
            new Error('Record not found'),
            new Error('Constraint violation')
          ),
          async (shortCode, userAgent, error) => {
            mockPrisma.link.update.mockRejectedValue(error);
            
            // Should never throw even on error
            await expect(trackClick(shortCode, userAgent, mockPrisma)).resolves.not.toThrow();
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: Bot user agents never trigger database update', async () => {
      const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.constantFrom(...botPatterns),
          fc.string(),
          fc.string(),
          async (shortCode, botPattern, prefix, suffix) => {
            const userAgent = `${prefix}${botPattern}${suffix}`;
            
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            await trackClick(shortCode, userAgent, mockPrisma);
            
            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Database should not be called for bots
            return mockPrisma.link.update.mock.calls.length === 0;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: Non-bot user agents always trigger database update', async () => {
      const nonBotAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6) Safari/604.1',
      ];
      
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.constantFrom(...nonBotAgents),
          async (shortCode, userAgent) => {
            // Reset mock for each property test run
            mockPrisma.link.update.mockClear();
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            await trackClick(shortCode, userAgent, mockPrisma);
            
            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Database should be called for non-bots
            return mockPrisma.link.update.mock.calls.length === 1;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: trackClick always uses increment operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.string(),
          async (shortCode, userAgent) => {
            // Reset mock for each property test run
            mockPrisma.link.update.mockClear();
            
            // Only test non-bot user agents
            if (isBot(userAgent)) {
              return true;
            }
            
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            await trackClick(shortCode, userAgent, mockPrisma);
            
            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (mockPrisma.link.update.mock.calls.length === 0) {
              return true; // Bot was detected
            }
            
            const call = mockPrisma.link.update.mock.calls[0][0];
            
            // Verify it uses increment operation
            return (
              call.where.shortCode === shortCode &&
              call.data.clickCount.increment === 1
            );
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: Multiple clicks increment count multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          nonEmptyString,  // Use nonEmptyString for userAgent too
          fc.integer({ min: 1, max: 10 }),
          async (shortCode, userAgent, clickCount) => {
            // Reset mock for each property test run
            mockPrisma.link.update.mockClear();
            
            // Only test non-bot user agents
            if (isBot(userAgent)) {
              return true;
            }
            
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            // Track multiple clicks
            for (let i = 0; i < clickCount; i++) {
              await trackClick(shortCode, userAgent, mockPrisma);
            }
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Should be called exactly clickCount times
            return mockPrisma.link.update.mock.calls.length === clickCount;
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: trackClick is fire-and-forget (returns immediately)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string(),
          async (shortCode, userAgent) => {
            // Mock slow database operation
            mockPrisma.link.update.mockImplementation(() => 
              new Promise(resolve => setTimeout(() => resolve({ clickCount: 1 }), 100))
            );
            
            const start = Date.now();
            await trackClick(shortCode, userAgent, mockPrisma);
            const duration = Date.now() - start;
            
            // Should return immediately (< 50ms)
            return duration < 50;
          }
        ),
        { numRuns: 25 }
      );
    });
  });
  
  describe('Click Count Monotonicity Property (Property 5)', () => {
    /**
     * Creates a stateful mock Prisma client that maintains click counts
     * This properly simulates the database behavior for testing monotonicity
     */
    function createStatefulMockPrisma() {
      const linkState = new Map<string, { clickCount: number }>();
      
      return {
        link: {
          update: jest.fn(async ({ where, data }: any) => {
            const shortCode = where.shortCode;
            
            // Initialize if doesn't exist
            if (!linkState.has(shortCode)) {
              linkState.set(shortCode, { clickCount: 0 });
            }
            
            const link = linkState.get(shortCode)!;
            
            // Apply increment
            if (data.clickCount?.increment) {
              link.clickCount += data.clickCount.increment;
            }
            
            return { shortCode, clickCount: link.clickCount };
          }),
          findUnique: jest.fn(async ({ where }: any) => {
            const shortCode = where.shortCode;
            const link = linkState.get(shortCode);
            
            if (!link) {
              return null;
            }
            
            return { shortCode, clickCount: link.clickCount };
          }),
        },
      };
    }
    
    it('Property 5: Click count only increases, never decreases - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.array(nonEmptyString, { minLength: 1, maxLength: 30 }),
          async (shortCode, userAgents) => {
            const statefulPrisma = createStatefulMockPrisma();
            const clickCounts: number[] = [];
            
            // Track all clicks
            for (const userAgent of userAgents) {
              await trackClick(shortCode, userAgent, statefulPrisma as any);
              
              // Small delay for async operation
              await new Promise(resolve => setTimeout(resolve, 5));
              
              // Get current count
              const link = await statefulPrisma.link.findUnique({ 
                where: { shortCode } 
              });
              
              if (link) {
                clickCounts.push(link.clickCount);
              }
            }
            
            // Verify monotonicity: each count >= previous count
            for (let i = 1; i < clickCounts.length; i++) {
              if (clickCounts[i] < clickCounts[i - 1]) {
                return false; // Violation: count decreased
              }
            }
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000); // 30 second timeout for property-based test
    
    it('Property 5: Click count never negative - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.array(nonEmptyString, { minLength: 1, maxLength: 20 }),
          async (shortCode, userAgents) => {
            const statefulPrisma = createStatefulMockPrisma();
            
            // Track all clicks
            for (const userAgent of userAgents) {
              await trackClick(shortCode, userAgent, statefulPrisma as any);
              await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            // Get final count
            const link = await statefulPrisma.link.findUnique({ 
              where: { shortCode } 
            });
            
            // Count should never be negative
            return !link || link.clickCount >= 0;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000);
    
    it('Property 5: Concurrent clicks all counted - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.array(nonEmptyString, { minLength: 5, maxLength: 15 }),
          async (shortCode, userAgents) => {
            const statefulPrisma = createStatefulMockPrisma();
            
            // Filter out bots to get expected count
            const nonBotAgents = userAgents.filter(ua => !isBot(ua));
            const expectedCount = nonBotAgents.length;
            
            // Track all clicks concurrently
            await Promise.all(
              userAgents.map(userAgent => 
                trackClick(shortCode, userAgent, statefulPrisma as any)
              )
            );
            
            // Wait for all async operations
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Get final count
            const link = await statefulPrisma.link.findUnique({ 
              where: { shortCode } 
            });
            
            // All non-bot clicks should be counted
            return link ? link.clickCount === expectedCount : expectedCount === 0;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000);
    
    it('Property 5: Bot clicks never increment count - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.array(
            fc.constantFrom(
              'Googlebot/2.1',
              'bingbot/2.0',
              'Slackbot-LinkExpanding 1.0',
              'facebookexternalhit/1.1',
              'Twitterbot/1.0',
              'curl/7.64.1',
              'wget/1.20.3',
              'python-requests/2.25.1'
            ),
            { minLength: 1, maxLength: 20 }
          ),
          async (shortCode, botUserAgents) => {
            const statefulPrisma = createStatefulMockPrisma();
            
            // Track all bot clicks
            for (const userAgent of botUserAgents) {
              await trackClick(shortCode, userAgent, statefulPrisma as any);
              await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            // Get final count
            const link = await statefulPrisma.link.findUnique({ 
              where: { shortCode } 
            });
            
            // Count should be 0 (no bot clicks counted)
            return !link || link.clickCount === 0;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000);
    
    it('Property 5: Mixed bot and non-bot clicks counted correctly - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyString,
          fc.array(
            fc.record({
              userAgent: fc.string(),
              isBot: fc.boolean(),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (shortCode, clicks) => {
            const statefulPrisma = createStatefulMockPrisma();
            
            // Generate appropriate user agents
            const userAgents = clicks.map(click => 
              click.isBot ? 'Googlebot/2.1' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
            );
            
            // Count expected non-bot clicks
            const expectedCount = clicks.filter(c => !c.isBot).length;
            
            // Track all clicks
            for (const userAgent of userAgents) {
              await trackClick(shortCode, userAgent, statefulPrisma as any);
              await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            // Get final count
            const link = await statefulPrisma.link.findUnique({ 
              where: { shortCode } 
            });
            
            // Count should match expected non-bot clicks
            return link ? link.clickCount === expectedCount : expectedCount === 0;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000);
    
    it('Property 5: Multiple links tracked independently - Feature: compact-url, Property 5: Click Count Monotonicity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              shortCode: nonEmptyString,
              clickCount: fc.integer({ min: 1, max: 10 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (links) => {
            const statefulPrisma = createStatefulMockPrisma();
            const userAgent = 'Mozilla/5.0 Chrome/91.0';
            
            // Track clicks for each link
            for (const link of links) {
              for (let i = 0; i < link.clickCount; i++) {
                await trackClick(link.shortCode, userAgent, statefulPrisma as any);
                await new Promise(resolve => setTimeout(resolve, 2));
              }
            }
            
            // Verify each link has correct count
            for (const link of links) {
              const dbLink = await statefulPrisma.link.findUnique({ 
                where: { shortCode: link.shortCode } 
              });
              
              if (!dbLink || dbLink.clickCount !== link.clickCount) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    }, 30000);
  });
  
  describe('Idempotence and consistency properties', () => {
    it('Property: isBot result does not depend on call order', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
          (userAgents) => {
            const results1 = userAgents.map(ua => isBot(ua));
            const results2 = userAgents.reverse().map(ua => isBot(ua)).reverse();
            
            return JSON.stringify(results1) === JSON.stringify(results2);
          }
        ),
        { numRuns: 25 }
      );
    });
    
    it('Property: trackClick behavior consistent across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string(),
          fc.integer({ min: 2, max: 5 }),
          async (shortCode, userAgent, repeatCount) => {
            mockPrisma.link.update.mockResolvedValue({ clickCount: 1 });
            
            const results: boolean[] = [];
            
            for (let i = 0; i < repeatCount; i++) {
              await trackClick(shortCode, userAgent, mockPrisma);
              results.push(isBot(userAgent));
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // All results should be the same
            return results.every(r => r === results[0]);
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
