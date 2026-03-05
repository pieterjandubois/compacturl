import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { getLinkWithCache } from '@/lib/cache';
import { trackClick } from '@/lib/click-tracker';
import { getRedisClient } from '@/lib/redis';

const prisma = new PrismaClient();

interface PageProps {
  params: {
    shortCode: string;
  };
}

export default async function RedirectPage({ params }: PageProps) {
  // In Next.js 14+, params is a Promise that needs to be awaited
  const { shortCode } = await params;

  // Get Redis client (may be null if disabled)
  const redis = getRedisClient();
  
  // Fetch link with cache
  const link = await getLinkWithCache(shortCode, prisma, redis);

  // Check if link exists
  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Link Not Found</h1>
          <p className="text-gray-600 mb-6">
            The short link you're looking for doesn't exist or has been removed.
          </p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  // Check expiration
  if (link.expiresAt && link.expiresAt <= new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Link Expired</h1>
          <p className="text-gray-600 mb-6">
            This link has expired and is no longer available.
          </p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create a New Link
          </a>
        </div>
      </div>
    );
  }

  // Track click asynchronously (fire-and-forget)
  if (link.isSaved) {
    const userAgent = headers().get('user-agent') || '';
    trackClick(link.shortCode, userAgent, prisma).catch((error) => {
      console.error('Failed to track click:', error);
      // Don't fail the redirect if tracking fails
    });
  }

  // Redirect to original URL
  // Note: redirect() throws a special error that Next.js catches - this is normal behavior
  redirect(link.originalUrl);
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
  // In Next.js 14+, params is a Promise that needs to be awaited
  const { shortCode } = await params;

  try {
    // Get Redis client (may be null if disabled)
    const redis = getRedisClient();
    const link = await getLinkWithCache(shortCode, new PrismaClient(), redis);

    if (link && (!link.expiresAt || link.expiresAt > new Date())) {
      return {
        title: `Redirecting to ${link.originalUrl}`,
        description: `You are being redirected to ${link.originalUrl}`,
      };
    }
  } catch (error) {
    console.error('Metadata generation error:', error);
  }

  return {
    title: 'CompactURL - Link Not Found',
    description: 'The requested short link was not found',
  };
}
