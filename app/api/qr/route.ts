import { NextRequest, NextResponse } from 'next/server';
import { generateQRCode } from '@/lib/qr-generator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/qr
 * Generate QR code for a URL
 * Requirements: 8.1, 8.2, 8.7, 8.8
 */
export async function GET(request: NextRequest) {
  try {
    // Parse url query parameter
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    // Validate URL parameter exists
    if (!url) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL parameter is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_URL',
            message: 'Invalid URL format',
          },
        },
        { status: 400 }
      );
    }

    // Generate QR code
    const qrBuffer = await generateQRCode(url);

    // Return PNG image with appropriate headers
    return new NextResponse(Buffer.from(qrBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      {
        error: {
          code: 'QR_GENERATION_ERROR',
          message: 'Failed to generate QR code',
        },
      },
      { status: 500 }
    );
  }
}
