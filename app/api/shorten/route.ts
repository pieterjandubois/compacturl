import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { validateUrl } from '@/lib/validation';
import { generateSmartShortCode } from '@/lib/smart-naming';
import { checkRateLimit } from '@/lib/rate-limiter';
import { cacheLink } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    // Get Redis client (may be null if Redis is disabled)
    const redis = getRedisClient();
    
    // Get session and IP address
    const session = await getServerSession(authOptions);
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               '127.0.0.1';

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL is required',
            details: [{ field: 'url', message: 'URL is required' }],
          },
        },
        { status: 400 }
      );
    }

    // Validate URL (3-tier validation)
    const validationResult = await validateUrl(url);
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error || 'Invalid URL',
            details: [
              {
                field: 'url',
                message: validationResult.error || 'Invalid URL',
                tier: validationResult.tier,
              },
            ],
          },
        },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimitIdentifier = session?.user?.id || ip;
    const rateLimitType: 'anonymous' | 'registered' = session?.user?.id ? 'registered' : 'anonymous';

    const rateLimitResult = await checkRateLimit(rateLimitIdentifier, rateLimitType, redis);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later.',
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        },
        { status: 429 }
      );
    }

    // Generate smart short code
    const { shortCode } = await generateSmartShortCode(url, prisma);

    // Calculate expiration (2 days for anonymous, null for registered)
    const expiresAt = session?.user?.id
      ? null
      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Create link in database
    const link = await prisma.link.create({
      data: {
        shortCode,
        originalUrl: url,
        userId: session?.user?.id || null,
        createdByIp: ip,
        isSaved: !!session?.user?.id,
        expiresAt,
        clickCount: 0,
      },
    });

    // Cache the link in Redis
    try {
      await cacheLink(
        shortCode,
        {
          originalUrl: link.originalUrl,
          userId: link.userId,
          expiresAt: link.expiresAt,
          isSaved: link.isSaved,
        },
        redis
      );
    } catch (cacheError) {
      console.error('Failed to cache link:', cacheError);
      // Don't fail the request if caching fails
    }

    // Build shortened URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const shortUrl = `${baseUrl}/${shortCode}`;

    return NextResponse.json(
      {
        data: {
          id: link.id,
          shortCode: link.shortCode,
          shortUrl,
          originalUrl: link.originalUrl,
          expiresAt: link.expiresAt,
          createdAt: link.createdAt,
        },
        message: 'URL shortened successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('URL shortening error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while shortening the URL',
        },
      },
      { status: 500 }
    );
  }
}
