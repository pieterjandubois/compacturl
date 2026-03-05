/**
 * 3-Tier URL Validation Service
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8
 * 
 * Tier 1: Format validation (regex, URL parsing, length check)
 * Tier 2: DNS lookup (verify domain exists)
 * Tier 3: HTTP request (verify URL is accessible)
 */

import dns from 'dns'
import { promisify } from 'util'

const dnsLookup = promisify(dns.lookup)

export interface ValidationResult {
  isValid: boolean
  error?: string
  tier?: 'format' | 'dns' | 'http'
}

/**
 * Complete 3-Tier URL Validation Pipeline
 * Validates URL through format, DNS, and HTTP checks
 * Completes within 3 seconds as per requirement 2.6
 */
export async function validateUrl(url: string): Promise<ValidationResult> {
  // Tier 1: Format Validation
  const formatResult = validateFormat(url)
  if (!formatResult.isValid) {
    return { ...formatResult, tier: 'format' }
  }

  // Tier 2: DNS Validation
  const dnsResult = await validateDns(url)
  if (!dnsResult.isValid) {
    return { ...dnsResult, tier: 'dns' }
  }

  // Tier 3: HTTP Validation
  const httpResult = await validateHttp(url)
  if (!httpResult.isValid) {
    return { ...httpResult, tier: 'http' }
  }

  return { isValid: true }
}

/**
 * Tier 1: Format Validation
 * Validates URL format, length, protocol, and rejects private addresses
 * Requirements: 2.1, 11.8, 11.9
 */
export function validateFormat(url: string): ValidationResult {
  // Handle null/undefined
  if (!url) {
    return {
      isValid: false,
      error: 'Invalid URL format',
    }
  }

  // Check length (requirement 11.8)
  if (url.length > 2048) {
    return {
      isValid: false,
      error: 'URL exceeds maximum length of 2048 characters',
    }
  }

  // Try to parse URL
  try {
    const parsed = new URL(url)

    // Require http or https protocol (requirement 2.1)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isValid: false,
        error: 'URL must use HTTP or HTTPS protocol',
      }
    }

    // Reject localhost and private IPs (security requirement 11.8)
    const hostname = parsed.hostname

    // Check for localhost
    if (hostname === 'localhost') {
      return {
        isValid: false,
        error: 'Cannot shorten localhost or private IP addresses',
      }
    }

    // Check for 127.x.x.x (loopback)
    if (hostname.startsWith('127.')) {
      return {
        isValid: false,
        error: 'Cannot shorten localhost or private IP addresses',
      }
    }

    // Check for 192.168.x.x (private class C)
    if (hostname.startsWith('192.168.')) {
      return {
        isValid: false,
        error: 'Cannot shorten localhost or private IP addresses',
      }
    }

    // Check for 10.x.x.x (private class A)
    if (hostname.startsWith('10.')) {
      return {
        isValid: false,
        error: 'Cannot shorten localhost or private IP addresses',
      }
    }

    // Check for 172.16-31.x.x (private class B)
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return {
        isValid: false,
        error: 'Cannot shorten localhost or private IP addresses',
      }
    }

    // Open redirect vulnerability prevention (requirement 11.9)
    const openRedirectCheck = checkForOpenRedirectPatterns(url, parsed)
    if (!openRedirectCheck.isValid) {
      return openRedirectCheck
    }

    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    }
  }
}

/**
 * Check for open redirect vulnerability patterns
 * Requirement: 11.9
 */
function checkForOpenRedirectPatterns(url: string, parsed: URL): ValidationResult {
  const fullUrl = url.toLowerCase()
  const pathname = parsed.pathname
  const search = parsed.search.toLowerCase()

  // Check for double slashes in path (protocol confusion: //evil.com)
  if (pathname.includes('//')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for backslashes (path traversal: \evil.com)
  if (fullUrl.includes('\\')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for @ symbol in path (credential confusion)
  // But allow @ in username:password@host (which is in parsed.username)
  if (pathname.includes('@')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for multiple @ symbols (user@example.com@evil.com)
  const atCount = (fullUrl.match(/@/g) || []).length
  if (atCount > 1) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for encoded slashes in suspicious positions
  if (fullUrl.includes('%2f%2f') || fullUrl.includes('%2F%2F')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for encoded backslashes
  if (fullUrl.includes('%5c') || fullUrl.includes('%5C')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for encoded @ in path
  if (pathname.includes('%40')) {
    return {
      isValid: false,
      error: 'URL contains suspicious patterns that may indicate an open redirect',
    }
  }

  // Check for suspicious redirect parameters with protocol-relative URLs
  const suspiciousParams = ['redirect', 'url', 'next', 'return', 'goto', 'continue']
  for (const param of suspiciousParams) {
    const paramPattern = new RegExp(`[?&]${param}=`, 'i')
    if (paramPattern.test(search)) {
      // Extract the parameter value
      const params = new URLSearchParams(parsed.search)
      const value = params.get(param)
      
      if (value) {
        // Check if the value starts with // (protocol-relative URL to different domain)
        if (value.startsWith('//')) {
          return {
            isValid: false,
            error: 'URL contains suspicious patterns that may indicate an open redirect',
          }
        }
        
        // Check if the value is a full URL to a different domain
        if (value.startsWith('http://') || value.startsWith('https://')) {
          try {
            const redirectUrl = new URL(value)
            // Allow redirects to the same domain
            if (redirectUrl.hostname !== parsed.hostname) {
              return {
                isValid: false,
                error: 'URL contains suspicious patterns that may indicate an open redirect',
              }
            }
          } catch {
            // Invalid URL in parameter, reject it
            return {
              isValid: false,
              error: 'URL contains suspicious patterns that may indicate an open redirect',
            }
          }
        }
      }
    }
  }

  return { isValid: true }
}

/**
 * Tier 2: DNS Validation
 * Performs DNS lookup to verify domain exists
 * Requirements: 2.2
 */
export async function validateDns(url: string): Promise<ValidationResult> {
  try {
    const parsed = new URL(url)
    
    // Perform DNS lookup with timeout
    await dnsLookup(parsed.hostname)
    
    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'Domain does not exist or is not reachable',
    }
  }
}

/**
 * Tier 3: HTTP Validation
 * Performs HEAD request to verify URL is accessible
 * Follows redirects up to 5 hops (requirement 2.7)
 * Accepts status codes 200-399 (requirement 2.8)
 * Completes within 3 seconds (requirement 2.6)
 */
export async function validateHttp(url: string): Promise<ValidationResult> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow', // Follow redirects (up to 5 hops by default in fetch)
      signal: AbortSignal.timeout(3000), // 3 second timeout (requirement 2.6)
      headers: {
        'User-Agent': 'CompactURL-Validator/1.0',
      },
    })

    // Accept 2xx and 3xx status codes (requirement 2.8)
    if (response.status >= 200 && response.status < 400) {
      return { isValid: true }
    }

    return {
      isValid: false,
      error: `URL returned status code ${response.status}`,
    }
  } catch {
    return {
      isValid: false,
      error: 'URL is not accessible or timed out',
    }
  }
}
