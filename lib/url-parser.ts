/**
 * URL Parser and Formatter Utilities
 * Provides functions to parse URLs into components and reconstruct them
 */

export interface UrlComponents {
  protocol: string
  domain: string
  path: string
  query: string
  hash?: string
}

export type ParseResult =
  | { success: true; data: UrlComponents }
  | { success: false; error: string }

/**
 * Parses a URL string into its components
 * @param url - The URL string to parse
 * @returns Result with parsed URL components or error
 */
export function parseUrl(url: string): ParseResult {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'Invalid URL format: URL must be a non-empty string',
    }
  }

  try {
    const urlObj = new URL(url)

    // Validate protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        success: false,
        error: `Invalid protocol: Must be http or https, got "${urlObj.protocol}"`,
      }
    }

    // Validate domain is not empty
    if (!urlObj.hostname) {
      return {
        success: false,
        error: 'Invalid URL format: domain cannot be empty',
      }
    }

    // Include port in domain if present
    const domain = urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname

    return {
      success: true,
      data: {
        protocol: urlObj.protocol,
        domain,
        path: urlObj.pathname === '/' ? '' : urlObj.pathname,
        query: urlObj.search.replace('?', ''),
        hash: urlObj.hash.replace('#', ''),
      },
    }
  } catch (error) {
    // Check if it's a URL with missing domain (e.g., "https://")
    if (url.match(/^https?:\/\/\s*$/)) {
      return {
        success: false,
        error: 'Invalid URL format: domain cannot be empty',
      }
    }
    return {
      success: false,
      error: `Invalid URL format: Unable to parse "${url}"`,
    }
  }
}

/**
 * Formats URL components back into a URL string
 * @param components - The URL components to format
 * @returns Formatted URL string
 */
export function formatUrl(components: UrlComponents): string {
  const { protocol, domain, path, query, hash } = components

  // Normalize protocol (remove colon if present)
  const normalizedProtocol = protocol.replace(':', '')

  // Build URL
  let url = `${normalizedProtocol}://${domain}`

  // Add path (ensure it starts with /)
  if (path) {
    url += path.startsWith('/') ? path : `/${path}`
  }

  // Add query (ensure it starts with ?)
  if (query) {
    url += query.startsWith('?') ? query : `?${query}`
  }

  // Add hash (ensure it starts with #)
  if (hash) {
    url += hash.startsWith('#') ? hash : `#${hash}`
  }

  return url
}
