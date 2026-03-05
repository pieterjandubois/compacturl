/**
 * Email verification system
 * 
 * **Async Processing Pattern:**
 * All email sending operations are designed to be fire-and-forget.
 * They should NOT be awaited in request handlers to avoid blocking responses.
 * 
 * Usage:
 * ```typescript
 * // Fire-and-forget pattern
 * sendVerificationEmail(email, name, token).catch(error => {
 *   console.error('Email failed:', error);
 * });
 * ```
 * 
 * Uses Resend for email delivery in production
 */

import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send an email using Resend
 * Falls back to console logging if Resend is not configured
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  console.log('📧 Attempting to send email...');
  console.log('- RESEND_API_KEY configured:', !!process.env.RESEND_API_KEY);
  console.log('- Resend client initialized:', !!resend);
  console.log('- From:', from);
  console.log('- To:', options.to);
  console.log('- Subject:', options.subject);

  // If Resend is configured, use it (regardless of environment)
  if (resend) {
    try {
      const result = await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log('Resend response:', JSON.stringify(result, null, 2));
      
      if (result.data?.id) {
        console.log('📧 Email ID:', result.data.id);
        console.log('🔍 Check email status at: https://resend.com/emails/' + result.data.id);
      }
      
      if (result.error) {
        console.error('⚠️ Resend returned an error:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  } else {
    // Resend not configured - log to console
    console.log('⚠️ RESEND_API_KEY not configured - email not sent');
    console.log('📧 Email details:');
    console.log('From:', from);
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
  }
}

/**
 * Generate verification email HTML template
 */
export function generateVerificationEmail(
  name: string,
  verificationUrl: string
): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
    <h1 style="color: #0066cc; margin-top: 0;">Welcome to CompactURL!</h1>
    <p>Hi ${name},</p>
    <p>Thank you for registering with CompactURL. Please verify your email address to activate your account.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" 
         style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Verify Email Address
      </a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 14px;">${verificationUrl}</p>
    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      This verification link will expire in 24 hours.
    </p>
    <p style="font-size: 14px; color: #666;">
      If you didn't create an account with CompactURL, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to CompactURL!

Hi ${name},

Thank you for registering with CompactURL. Please verify your email address to activate your account.

Verification link: ${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with CompactURL, you can safely ignore this email.
  `.trim();

  return { html, text };
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify?token=${token}`;

  const { html, text } = generateVerificationEmail(name, verificationUrl);

  await sendEmail({
    to: email,
    subject: 'Verify your CompactURL account',
    html,
    text,
  });
}

/**
 * Generate password reset email HTML template
 */
export function generatePasswordResetEmail(
  name: string,
  resetUrl: string
): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
    <h1 style="color: #0066cc; margin-top: 0;">Reset Your Password</h1>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password for your CompactURL account.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" 
         style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Reset Password
      </a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      This password reset link will expire in 1 hour.
    </p>
    <p style="font-size: 14px; color: #666;">
      If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Reset Your Password

Hi ${name},

We received a request to reset your password for your CompactURL account.

Reset link: ${resetUrl}

This password reset link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
  `.trim();

  return { html, text };
}

/**
 * Generate link expiration warning email HTML template
 */
export function generateExpirationWarningEmail(
  name: string,
  shortCode: string,
  originalUrl: string,
  expiresAt: Date
): { html: string; text: string } {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const shortUrl = `${baseUrl}/${shortCode}`;
  const dashboardUrl = `${baseUrl}/dashboard`;
  const expirationDate = expiresAt.toLocaleDateString();
  const expirationTime = expiresAt.toLocaleTimeString();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Link is Expiring Soon</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; border-left: 4px solid #ffc107;">
    <h1 style="color: #856404; margin-top: 0;">⚠️ Your Link is Expiring Soon</h1>
    <p>Hi ${name},</p>
    <p>This is a friendly reminder that one of your shortened links will expire in 24 hours.</p>
    
    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; font-weight: bold;">Short URL:</p>
      <p style="margin: 5px 0; word-break: break-all;">
        <a href="${shortUrl}" style="color: #0066cc;">${shortUrl}</a>
      </p>
      
      <p style="margin: 15px 0 0 0; font-weight: bold;">Original URL:</p>
      <p style="margin: 5px 0; word-break: break-all; color: #666; font-size: 14px;">${originalUrl}</p>
      
      <p style="margin: 15px 0 0 0; font-weight: bold;">Expires:</p>
      <p style="margin: 5px 0; color: #dc3545; font-weight: bold;">${expirationDate} at ${expirationTime}</p>
    </div>
    
    <p><strong>Want to keep this link?</strong></p>
    <p>You can save this link to your account to prevent it from expiring. Saved links never expire!</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" 
         style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Go to Dashboard
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      If you don't save this link, it will be automatically deleted after expiration and will no longer work.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
⚠️ Your Link is Expiring Soon

Hi ${name},

This is a friendly reminder that one of your shortened links will expire in 24 hours.

Short URL: ${shortUrl}
Original URL: ${originalUrl}
Expires: ${expirationDate} at ${expirationTime}

Want to keep this link?
You can save this link to your account to prevent it from expiring. Saved links never expire!

Go to your dashboard: ${dashboardUrl}

If you don't save this link, it will be automatically deleted after expiration and will no longer work.
  `.trim();

  return { html, text };
}

/**
 * Send expiration warning email to user
 */
export async function sendExpirationWarningEmail(
  email: string,
  name: string,
  shortCode: string,
  originalUrl: string,
  expiresAt: Date
): Promise<void> {
  const { html, text } = generateExpirationWarningEmail(
    name,
    shortCode,
    originalUrl,
    expiresAt
  );

  await sendEmail({
    to: email,
    subject: '⚠️ Your CompactURL link expires in 24 hours',
    html,
    text,
  });
}
