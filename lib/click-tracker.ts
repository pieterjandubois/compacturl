/**
 * Click Tracker
 * 
 * Tracks clicks for shortened URLs with bot detection.
 * 
 * **Validates: Requirements 6.1, 6.4, 6.5**
 * **Validates: Property 4 - Click Count Monotonicity**
 * 
 * Features:
 * - Async click tracking (fire-and-forget)
 * - Bot detection to filter automated traffic
 * - Error handling (logs but doesn't fail redirects)
 * - Eventual consistency for click counts
 */

import { PrismaClient } from '@prisma/client';

/**
 * Detects bot user agents
 * 
 * Checks if the user agent string matches known bot patterns.
 * Detection is case-insensitive.
 * 
 * Known bot patterns:
 * - bot (Googlebot, bingbot, Slackbot, etc.)
 * - crawler
 * - spider
 * - scraper
 * - curl
 * - wget
 * - python (python-requests, python-urllib, etc.)
 * 
 * @param userAgent - The user agent string from the request
 * @returns true if bot detected, false otherwise
 * 
 * @example
 * isBot('Googlebot/2.1') // true
 * isBot('Mozilla/5.0 Chrome/91.0') // false
 */
export function isBot(userAgent: string): boolean {
  if (!userAgent) {
    return false;
  }
  
  // Bot detection patterns (case-insensitive)
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /facebookexternalhit/i,
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Tracks click for a shortened URL
 * 
 * Increments the click count in the database asynchronously.
 * This is a fire-and-forget operation that doesn't block the redirect.
 * 
 * Bot traffic is filtered out using the isBot() function.
 * Errors are caught and logged but don't fail the operation.
 * 
 * @param shortCode - The short code of the link
 * @param userAgent - The user agent string from the request
 * @param prisma - Prisma client instance
 * @returns Promise that resolves immediately (fire-and-forget)
 * 
 * @example
 * await trackClick('test-link', 'Mozilla/5.0 Chrome/91.0', prisma);
 * // Returns immediately, database update happens asynchronously
 */
export async function trackClick(
  shortCode: string,
  userAgent: string,
  prisma: PrismaClient
): Promise<void> {
  // Validate inputs - reject empty or whitespace-only shortCode
  if (!shortCode || shortCode.trim().length === 0) {
    return;
  }
  
  // Normalize userAgent - treat undefined/null as empty string
  // Empty user agent is allowed (not a bot, just unknown client)
  const normalizedUserAgent = userAgent ?? '';
  
  // Check if bot
  if (isBot(normalizedUserAgent)) {
    return;
  }
  
  // Check if prisma client is available
  if (!prisma || !prisma.link) {
    return;
  }
  
  // Async increment (fire and forget)
  // We don't await this promise - it runs in the background
  prisma.link
    .update({
      where: { shortCode },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    })
    .catch((error) => {
      // Log error but don't fail the redirect
      console.error('Failed to track click:', error);
    });
}
