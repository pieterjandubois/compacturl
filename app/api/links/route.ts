import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * GET /api/links
 * Get user's saved links with sorting
 * Requirements: 5.4, 5.9
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sort') || 'date';
    const order = searchParams.get('order') || 'desc';

    // Build orderBy clause
    let orderBy: Prisma.LinkOrderByWithRelationInput;

    if (sortBy === 'name') {
      orderBy = { shortCode: order === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy === 'clicks') {
      orderBy = { clickCount: order === 'asc' ? 'asc' : 'desc' };
    } else {
      // Default: sort by date
      orderBy = { createdAt: order === 'asc' ? 'asc' : 'desc' };
    }

    // Fetch user's saved links
    const links = await prisma.link.findMany({
      where: {
        userId: user.id,
        isSaved: true,
      },
      orderBy,
      select: {
        id: true,
        shortCode: true,
        originalUrl: true,
        createdAt: true,
        clickCount: true,
        expiresAt: true,
      },
    });

    // Format response with shortened URLs
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const formattedLinks = links.map((link) => ({
      id: link.id,
      shortCode: link.shortCode,
      shortUrl: `${baseUrl}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      createdAt: link.createdAt.toISOString(),
      clickCount: link.clickCount,
      expiresAt: link.expiresAt?.toISOString() || null,
    }));

    return NextResponse.json({
      data: formattedLinks,
      meta: {
        count: formattedLinks.length,
        sortBy,
        order,
      },
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch links',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/links
 * Delete all user's saved links
 * Requirements: 5.6
 */
export async function DELETE(request: NextRequest) {
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

    // Fetch all user's saved links (to invalidate caches)
    const links = await prisma.link.findMany({
      where: {
        userId: user.id,
        isSaved: true,
      },
      select: {
        id: true,
        shortCode: true,
      },
    });

    // Delete all links in transaction
    const result = await prisma.link.deleteMany({
      where: {
        userId: user.id,
        isSaved: true,
      },
    });

    // Invalidate all caches
    const { invalidateLinkCache } = await import('@/lib/cache');
    for (const link of links) {
      await invalidateLinkCache(link.shortCode);
    }

    return NextResponse.json({
      data: {
        deleted: result.count,
      },
      meta: {
        message: `Successfully deleted ${result.count} link(s)`,
      },
    });
  } catch (error) {
    console.error('Error deleting all links:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete links',
        },
      },
      { status: 500 }
    );
  }
}
