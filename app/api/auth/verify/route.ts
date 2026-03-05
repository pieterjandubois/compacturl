import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    console.log('Verification attempt with token:', token);

    if (!token) {
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
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    console.log('Found verification token:', verificationToken);

    if (!verificationToken) {
      // Check if any tokens exist for debugging
      const allTokens = await prisma.verificationToken.findMany();
      console.log('All tokens in database:', allTokens.length);
      
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired verification token',
          },
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      console.log('Token expired:', verificationToken.expires);
      
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

    console.log('Verifying email for:', verificationToken.identifier);

    // Update user's emailVerified field
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete used token
    await prisma.verificationToken.delete({
      where: { token },
    });

    console.log('Email verified successfully');

    return NextResponse.json(
      {
        data: {
          message: 'Email verified successfully',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
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
