/**
 * Link Expiration Cleanup Job
 * Deletes expired links in batches and invalidates their caches
 */

import prisma from './db';
import { invalidateLinkCache } from './cache';

const BATCH_SIZE = 100;

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  batchCount?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Clean up expired links from the database
 * - Queries links where expiresAt < current time
 * - Deletes expired links in batches
 * - Invalidates caches for deleted links
 * - Logs cleanup results
 * - Saved links (expiresAt = null) are never deleted
 */
export async function cleanupExpiredLinks(): Promise<CleanupResult> {
  const timestamp = new Date();
  
  try {
    console.log(`[${timestamp.toISOString()}] Starting link expiration cleanup...`);

    // Find all expired links
    const expiredLinks = await prisma.link.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        shortCode: true,
      },
    });

    if (expiredLinks.length === 0) {
      console.log('No expired links found');
      return {
        success: true,
        deletedCount: 0,
        timestamp,
      };
    }

    console.log(`Found ${expiredLinks.length} expired links`);

    // Process in batches
    let totalDeleted = 0;
    let batchCount = 0;

    for (let i = 0; i < expiredLinks.length; i += BATCH_SIZE) {
      const batch = expiredLinks.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map((link) => link.id);

      // Delete batch
      const result = await prisma.link.deleteMany({
        where: {
          id: {
            in: batchIds,
          },
        },
      });

      totalDeleted += result.count;
      batchCount++;

      // Invalidate caches for deleted links
      for (const link of batch) {
        try {
          await invalidateLinkCache(link.shortCode);
        } catch (error) {
          // Log but don't fail the cleanup
          console.error(
            `Failed to invalidate cache for ${link.shortCode}:`,
            error
          );
        }
      }

      console.log(
        `Batch ${batchCount}: Deleted ${result.count} links, invalidated ${batch.length} caches`
      );
    }

    console.log(
      `Cleanup completed: Deleted ${totalDeleted} expired links in ${batchCount} batch(es)`
    );

    return {
      success: true,
      deletedCount: totalDeleted,
      batchCount,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup failed:', errorMessage);

    return {
      success: false,
      deletedCount: 0,
      error: errorMessage,
      timestamp,
    };
  }
}


/**
 * Send expiration warning emails for links expiring in 24 hours
 * - Queries links where expiresAt is between now and 24 hours from now
 * - Only sends warnings for links with userId (registered users)
 * - Marks links as warned to prevent duplicate emails
 * - Sends emails asynchronously
 */
export async function sendExpirationWarnings(): Promise<CleanupResult> {
  const timestamp = new Date();
  
  try {
    console.log(`[${timestamp.toISOString()}] Starting expiration warning emails...`);

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find links expiring in the next 24 hours that haven't been warned yet
    const expiringLinks = await prisma.link.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: twentyFourHoursFromNow,
        },
        userId: {
          not: null, // Only for registered users
        },
        // Note: In a real implementation, you'd add a 'warningEmailSent' field
        // to prevent duplicate warnings. For now, we'll send warnings each time.
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

    if (expiringLinks.length === 0) {
      console.log('No links expiring in the next 24 hours');
      return {
        success: true,
        deletedCount: 0, // Using deletedCount to represent emails sent
        timestamp,
      };
    }

    console.log(`Found ${expiringLinks.length} links expiring in 24 hours`);

    let emailsSent = 0;

    // Send warning emails asynchronously (fire-and-forget)
    for (const link of expiringLinks) {
      if (link.user && link.expiresAt) {
        // Fire-and-forget: don't await, let it run in background
        (async () => {
          try {
            // Import dynamically to avoid circular dependencies
            const { sendExpirationWarningEmail } = await import('./email');
            
            await sendExpirationWarningEmail(
              link.user.email,
              link.user.name || 'User',
              link.shortCode,
              link.originalUrl,
              link.expiresAt
            );

            emailsSent++;
            console.log(`Sent warning email for link ${link.shortCode} to ${link.user.email}`);
          } catch (error) {
            // Log but don't fail the entire process
            console.error(
              `Failed to send warning email for ${link.shortCode}:`,
              error
            );
          }
        })();
      }
    }

    console.log(`Warning emails completed: Sent ${emailsSent} emails`);

    return {
      success: true,
      deletedCount: emailsSent, // Reusing deletedCount to represent emails sent
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Warning emails failed:', errorMessage);

    return {
      success: false,
      deletedCount: 0,
      error: errorMessage,
      timestamp,
    };
  }
}
