import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { invalidateLinkCache } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';

/**
 * DELETE /api/links/[id]
 * Delete a specific link
 * Requirements: 5.5, 5.7
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Find link by ID
    const link = await prisma.link.findUnique({
      where: { id },
    });

    if (!link) {
      return NextResponse.json(
        { error: { code: 'LINK_NOT_FOUND', message: 'Link not found' } },
        { status: 404 }
      );
    }

    // Verify ownership
    if (link.userId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot delete link that belongs to another user',
          },
        },
        { status: 403 }
      );
    }

    // Delete link from database
    await prisma.link.delete({
      where: { id },
    });

    // Invalidate cache
    const redis = getRedisClient();
    await invalidateLinkCache(link.shortCode, redis);

    // Return 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete link',
        },
      },
      { status: 500 }
    );
  }
}
