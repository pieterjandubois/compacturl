import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { invalidateLinkCache } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';

/**
 * POST /api/links/save
 * Save (claim) an anonymous link
 * Requirements: 5.1, 5.2, 5.11
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { shortCode } = body;

    if (!shortCode || typeof shortCode !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: [{ field: 'shortCode', message: 'Short code is required' }],
          },
        },
        { status: 400 }
      );
    }

    // Find link in database
    const link = await prisma.link.findUnique({
      where: { shortCode },
    });

    if (!link) {
      return NextResponse.json(
        { error: { code: 'LINK_NOT_FOUND', message: 'Link not found' } },
        { status: 404 }
      );
    }

    // Verify ownership (cannot claim links that belong to other users)
    if (link.userId !== null && link.userId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot claim link that belongs to another user',
          },
        },
        { status: 403 }
      );
    }

    // Update link: isSaved=true, expiresAt=null, userId
    const updatedLink = await prisma.link.update({
      where: { id: link.id },
      data: {
        userId: user.id,
        isSaved: true,
        expiresAt: null,
      },
    });

    // Invalidate cache
    const redis = getRedisClient();
    await invalidateLinkCache(shortCode, redis);

    // Return success response
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    return NextResponse.json({
      data: {
        id: updatedLink.id,
        shortCode: updatedLink.shortCode,
        shortUrl: `${baseUrl}/${updatedLink.shortCode}`,
        originalUrl: updatedLink.originalUrl,
        createdAt: updatedLink.createdAt.toISOString(),
        clickCount: updatedLink.clickCount,
        expiresAt: null,
        isSaved: true,
      },
      meta: {
        message: 'Link saved successfully',
      },
    });
  } catch (error) {
    console.error('Error saving link:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to save link',
        },
      },
      { status: 500 }
    );
  }
}
