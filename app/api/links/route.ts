import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Helper function to get and verify user
 * Includes retry logic to handle race conditions where emailVerified might not be updated yet
 */
async function getVerifiedUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    }
  });

  if (!user) {
    return { error: { code: 'USER_NOT_FOUND', message: 'User not found' }, status: 404 };
  }

  // If email is not verified, try again with retries
  // This handles the race condition where verification just completed but database hasn't replicated yet
  if (!user.emailVerified) {
    console.log('⚠️ Email not verified for user:', user.email, '- attempting retry...');
    
    // Retry up to 5 times with 200ms delays (max 1 second total)
    let retryAttempts = 0;
    const maxRetries = 5;
    const delayMs = 200;
    
    while (retryAttempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      retryAttempts++;
      
      console.log(`🔄 Retry ${retryAttempts}/${maxRetries} - checking emailVerified status...`);
      
      const retryUser = await prisma.user.findUnique({
        where: { email },
        select: { emailVerified: true }
      });
      
      if (retryUser?.emailVerified) {
        console.log('✅ Email verified confirmed on retry attempt', retryAttempts);
        return { user: { ...user, emailVerified: retryUser.emailVerified } };
      }
    }
    
    // After all retries, still not verified
    console.log('❌ Email not verified for user after retries:', user.email);
    return { 
      error: { 
        code: 'EMAIL_NOT_VERIFIED', 
        message: 'Please verify your email address. Check your inbox for the verification link.' 
      }, 
      status: 403 
    };
  }

  return { user };
}

/**
 * GET /api/links
 * Get user's saved links with sorting
 * Requirements: 5.4, 5.9
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    console.log('Links API - Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasEmail: !!session?.user?.email,
      email: session?.user?.email,
      userId: (session?.user as any)?.id
    });

    if (!session || !session.user?.email) {
      console.log('❌ No session or email - returning 401');
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get and verify user
    const result = await getVerifiedUser(session.user.email);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { user } = result;

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

    // Get and verify user
    const userResult = await getVerifiedUser(session.user.email);
    if ('error' in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }
    const { user } = userResult;

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
    const deleteResult = await prisma.link.deleteMany({
      where: {
        userId: user.id,
        isSaved: true,
      },
    });

    // Invalidate all caches
    const { invalidateLinkCache } = await import('@/lib/cache');
    const { getRedisClient } = await import('@/lib/redis');
    const redis = getRedisClient();
    for (const link of links) {
      await invalidateLinkCache(link.shortCode, redis);
    }

    return NextResponse.json({
      data: {
        deleted: deleteResult.count,
      },
      meta: {
        message: `Successfully deleted ${deleteResult.count} link(s)`,
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
