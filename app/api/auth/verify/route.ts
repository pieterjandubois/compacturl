import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    console.log('=== EMAIL VERIFICATION ATTEMPT ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Token received:', token);
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    if (!token) {
      console.log('❌ No token provided');
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Verification token is required',
          },
        },
        { status: 400 }
      );
    }

    // Find verification token
    console.log('🔍 Looking up token in database...');
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    console.log('Token lookup result:', verificationToken ? 'FOUND' : 'NOT FOUND');
    if (verificationToken) {
      console.log('Token details:', {
        identifier: verificationToken.identifier,
        expires: verificationToken.expires,
        isExpired: verificationToken.expires < new Date()
      });
    }

    if (!verificationToken) {
      // Check if user is already verified (duplicate request scenario)
      console.log('🔍 Token not found, checking if user already verified...');
      
      const allTokens = await prisma.verificationToken.findMany();
      console.log('Total tokens in database:', allTokens.length);
      
      // This could be a duplicate request where the token was already used
      // Return a helpful message
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired verification token. If you just verified your email, you can proceed to login.',
          },
        },
        { status: 400 }
      );
    }

    // Check if user is already verified (duplicate request)
    const existingUser = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
      select: { emailVerified: true, email: true }
    });

    if (existingUser?.emailVerified) {
      // Already verified - this is a duplicate request
      console.log('✅ Email already verified (duplicate request detected)');
      console.log('User:', existingUser.email, 'verified at:', existingUser.emailVerified);
      
      // Delete the token if it still exists
      await prisma.verificationToken.deleteMany({
        where: { identifier: verificationToken.identifier }
      });
      
      console.log('=== VERIFICATION SUCCESSFUL (ALREADY VERIFIED) ===');
      
      return NextResponse.json(
        {
          data: {
            message: 'Email verified successfully',
          },
        },
        { status: 200 }
      );
    }

    // Check if token is expired
    const now = new Date();
    const isExpired = verificationToken.expires < now;
    console.log('Token expiration check:', {
      now: now.toISOString(),
      expires: verificationToken.expires.toISOString(),
      isExpired
    });
    
    if (isExpired) {
      console.log('❌ Token expired');
      
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token },
      });

      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Verification token has expired. Please register again.',
          },
        },
        { status: 400 }
      );
    }

    console.log('✅ Token is valid, verifying email for:', verificationToken.identifier);

    // Update user's emailVerified field
    const updatedUser = await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });
    
    console.log('✅ User email verified:', {
      userId: updatedUser.id,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified
    });

    // Delete used token
    await prisma.verificationToken.delete({
      where: { token },
    });
    
    console.log('✅ Verification token deleted');
    console.log('=== VERIFICATION SUCCESSFUL ===');

    return NextResponse.json(
      {
        data: {
          message: 'Email verified successfully',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('=== EMAIL VERIFICATION ERROR ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during email verification',
        },
      },
      { status: 500 }
    );
  }
}
