import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email, password, and name are required',
            details: [
              { field: 'email', message: !email ? 'Email is required' : undefined },
              { field: 'password', message: !password ? 'Password is required' : undefined },
              { field: 'name', message: !name ? 'Name is required' : undefined },
            ].filter((d) => d.message),
          },
        },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
            details: [{ field: 'email', message: 'Invalid email format' }],
          },
        },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password does not meet requirements',
            details: [
              {
                field: 'password',
                message:
                  'Password must be at least 12 characters with uppercase, lowercase, number, and special character',
              },
            ],
          },
        },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email already exists',
            details: [{ field: 'email', message: 'Email already exists' }],
          },
        },
        { status: 400 }
      );
    }

    // Hash password with bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token (64 characters hex)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    console.log('User created:', user.id);

    // Create verification token
    const tokenRecord = await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: tokenExpiry,
      },
    });

    console.log('Verification token created:', tokenRecord.token);

    // Send verification email asynchronously (fire-and-forget)
    console.log('🚀 Initiating email send...');
    sendVerificationEmail(email, name, verificationToken)
      .then(() => {
        console.log('✅ Email send completed successfully');
      })
      .catch((emailError) => {
        console.error('❌ Failed to send verification email:', emailError);
        console.error('Email error stack:', emailError.stack);
        // Error is logged but doesn't affect registration response
      });

    console.log('📬 Email send initiated (async)');

    return NextResponse.json(
      {
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
        message: 'Registration successful. Please check your email to verify your account.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during registration',
        },
      },
      { status: 500 }
    );
  }
}
