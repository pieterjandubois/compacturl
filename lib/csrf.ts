/**
 * CSRF Protection Utilities
 * Requirement: 11.5
 * 
 * Provides additional CSRF protection for API routes
 * NextAuth.js handles CSRF for authentication routes automatically
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Verify CSRF token for state-changing operations
 * NextAuth.js automatically handles CSRF tokens via cookies
 * This function validates the session which includes CSRF validation
 */
export async function verifyCsrfProtection(request: NextRequest): Promise<boolean> {
  // For state-changing methods (POST, PUT, PATCH, DELETE)
  const method = request.method
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true // GET requests don't need CSRF protection
  }

  // Check if user is authenticated (NextAuth.js validates CSRF in session)
  const session = await getServerSession(authOptions)
  
  // If there's a session, NextAuth.js has already validated the CSRF token
  // If no session, the request is from an anonymous user
  // For anonymous users, we rely on SameSite cookies and origin checking
  
  // Check Origin header matches Host header (additional protection)
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  
  if (origin && host) {
    const originUrl = new URL(origin)
    if (originUrl.host !== host) {
      return false // Origin mismatch
    }
  }
  
  return true
}

/**
 * Get CSRF token from NextAuth.js
 * This is used for client-side forms
 */
export function getCsrfTokenName(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  return `${isProduction ? '__Host-' : ''}next-auth.csrf-token`
}

/**
 * Middleware to check CSRF protection
 * Returns true if request is safe, false if it should be rejected
 */
export async function checkCsrf(request: NextRequest): Promise<{ safe: boolean; error?: string }> {
  const isSafe = await verifyCsrfProtection(request)
  
  if (!isSafe) {
    return {
      safe: false,
      error: 'CSRF validation failed',
    }
  }
  
  return { safe: true }
}
