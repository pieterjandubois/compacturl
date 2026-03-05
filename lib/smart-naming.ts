/**
 * Smart Naming Engine - URL Parsing Utilities
 * 
 * This module provides utility functions for parsing URLs and generating
 * meaningful short codes for the CompactURL service.
 * 
 * Requirements: 1.3, 1.5, 1.6, 1.7, 1.8, 1.9
 */

/**
 * Extracts the main domain name from a URL, excluding common subdomains.
 * 
 * Algorithm:
 * 1. Parse the hostname from the URL
 * 2. Split hostname into parts by '.'
 * 3. Remove common subdomains (www, blog, api, m, mobile) if present
 * 4. Return the main domain name (without TLD)
 * 
 * Examples:
 * - https://www.linkedin.com/in/john-doe → "linkedin"
 * - https://blog.example.com/post → "example"
 * - https://api.github.com/users → "github"
 * - https://example.com → "example"
 * 
 * @param url - Parsed URL object
 * @returns Main domain name without common subdomains and TLD
 * 
 * Requirements: 1.3, 1.9
 */
export function extractDomain(url: URL): string {
  const hostname = url.hostname;
  const parts = hostname.split('.');

  // Remove common subdomains if hostname has more than 2 parts
  const commonSubdomains = ['www', 'blog', 'api', 'm', 'mobile'];
  if (parts.length > 2 && commonSubdomains.includes(parts[0])) {
    parts.shift();
  }

  // Return main domain (first part after removing subdomain, excluding TLD)
  return parts[0];
}

/**
 * Extracts the last meaningful path segment from a URL.
 * 
 * Algorithm:
 * 1. Split the pathname by '/'
 * 2. Filter out empty segments
 * 3. Return the last segment, or empty string if no segments exist
 * 
 * Examples:
 * - https://linkedin.com/in/john-doe → "john-doe"
 * - https://github.com/user/repo/issues → "issues"
 * - https://example.com/ → ""
 * - https://example.com/blog/2024/post-title → "post-title"
 * 
 * @param url - Parsed URL object
 * @returns Last path segment or empty string
 * 
 * Requirements: 1.3, 1.10
 */
export function extractLastPathSegment(url: URL): string {
  const pathSegments = url.pathname
    .split('/')
    .filter((segment) => segment.length > 0);

  return pathSegments[pathSegments.length - 1] || '';
}

/**
 * Sanitizes and truncates a short code to meet requirements.
 * 
 * Algorithm:
 * 1. Convert to lowercase
 * 2. Replace all special characters (except hyphens) with hyphens
 * 3. Remove consecutive hyphens
 * 4. Remove leading and trailing hyphens
 * 5. Truncate to maxLength, attempting to break at word boundaries (hyphens)
 * 
 * Rules:
 * - Only alphanumeric characters and hyphens allowed
 * - All lowercase
 * - Maximum length (default 10 characters)
 * - Intelligent truncation at word boundaries when possible
 * 
 * Examples:
 * - "LinkedIn-John_Doe" → "linkedin-jo" (truncated at 10 chars)
 * - "GitHub@User#123" → "github-user" (special chars replaced)
 * - "example---test" → "example-te" (consecutive hyphens removed)
 * - "-start-end-" → "start-end" (leading/trailing hyphens removed)
 * 
 * @param code - Raw short code to sanitize
 * @param maxLength - Maximum length for the short code (default: 10)
 * @returns Sanitized short code
 * 
 * Requirements: 1.5, 1.6, 1.7, 1.8
 */
export function sanitizeShortCode(code: string, maxLength: number = 10): string {
  // Convert to lowercase
  let sanitized = code.toLowerCase();

  // Remove special characters except hyphens (replace with hyphens)
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Truncate at word boundary if exceeds maxLength
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    
    // Try to break at last hyphen (word boundary)
    // Only break if the hyphen is in the second half to avoid too-short codes
    const lastHyphen = sanitized.lastIndexOf('-');
    if (lastHyphen > maxLength / 2) {
      sanitized = sanitized.substring(0, lastHyphen);
    }
  }

  return sanitized;
}

/**
 * Generates a smart short code from a URL with uniqueness checking.
 * 
 * Algorithm:
 * 1. Parse the URL
 * 2. Extract domain and last path segment
 * 3. Combine them (domain-path or just domain if no path)
 * 4. Sanitize the combined string
 * 5. Check uniqueness in database
 * 6. If not unique, append -2, -3, etc. until unique
 * 
 * @param url - The full URL to generate a short code for
 * @param prisma - Prisma client for database uniqueness checking
 * @returns Object containing the short code, uniqueness status, and attempt number
 * 
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 */
export async function generateSmartShortCode(
  url: string,
  prisma: { link: { findUnique: (args: { where: { shortCode: string } }) => Promise<unknown> } }
): Promise<{ shortCode: string; isUnique: boolean; attemptNumber: number }> {
  // Parse the URL
  const parsedUrl = new URL(url);

  // Extract domain and path
  const domain = extractDomain(parsedUrl);
  const pathSegment = extractLastPathSegment(parsedUrl);

  // Combine domain and path (if path exists)
  const combined = pathSegment ? `${domain}-${pathSegment}` : domain;

  // Sanitize to get base short code
  const baseShortCode = sanitizeShortCode(combined);

  // Check uniqueness and append suffix if needed
  let attemptNumber = 1;
  let currentShortCode = baseShortCode;
  let isUnique = false;

  while (!isUnique) {
    // Check if short code exists in database
    const existing = await prisma.link.findUnique({
      where: { shortCode: currentShortCode },
    });

    if (!existing) {
      // Short code is unique
      isUnique = true;
    } else {
      // Short code exists, try next suffix
      attemptNumber++;
      currentShortCode = `${baseShortCode}-${attemptNumber}`;
    }
  }

  return {
    shortCode: currentShortCode,
    isUnique: true,
    attemptNumber,
  };
}
