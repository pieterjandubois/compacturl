/**
 * Next.js Middleware for Security Headers
 * Requirements: 11.4, 11.5, 11.6
 * 
 * Sets security headers on all responses:
 * - X-Frame-Options: DENY (prevent clickjacking)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - X-XSS-Protection: 1; mode=block (XSS protection)
 * - Content-Security-Policy (CSP)
 * - Referrer-Policy (control referrer information)
 * - HTTPS enforcement in production
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // X-Frame-Options: Prevent clickjacking attacks
  // Requirement: 11.4
  response.headers.set('X-Frame-Options', 'DENY')

  // X-Content-Type-Options: Prevent MIME type sniffing
  // Requirement: 11.4
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // X-XSS-Protection: Enable browser XSS protection
  // Requirement: 11.4
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy: Control referrer information
  // Requirement: 11.4
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Content-Security-Policy: Restrict resource loading
  // Requirement: 11.4
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))

  // Permissions-Policy: Control browser features
  // Requirement: 11.4
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  )

  // Strict-Transport-Security: Enforce HTTPS (production only)
  // Requirement: 11.6
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // HTTPS redirect in production
  // Requirement: 11.6
  if (process.env.NODE_ENV === 'production') {
    const protocol = request.headers.get('x-forwarded-proto')
    if (protocol === 'http') {
      const url = request.nextUrl.clone()
      url.protocol = 'https'
      return NextResponse.redirect(url, 301)
    }
  }

  return response
}

// Apply middleware to all routes except static files and API routes that don't need it
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
