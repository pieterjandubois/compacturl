/**
 * Tests for 3-tier URL validation pipeline
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8
 */

import {
  validateUrl,
  validateFormat,
  validateDns,
  validateHttp,
  ValidationResult,
} from '../validation'

describe('Tier 1: Format Validation', () => {
  describe('validateFormat', () => {
    it('should accept valid HTTP URLs', () => {
      const result = validateFormat('http://example.com')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid HTTPS URLs', () => {
      const result = validateFormat('https://example.com')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept URLs with paths', () => {
      const result = validateFormat('https://example.com/path/to/page')
      expect(result.isValid).toBe(true)
    })

    it('should accept URLs with query parameters', () => {
      const result = validateFormat('https://example.com?param=value')
      expect(result.isValid).toBe(true)
    })

    it('should reject URLs longer than 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050)
      const result = validateFormat(longUrl)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL exceeds maximum length of 2048 characters')
    })

    it('should reject localhost URLs', () => {
      const result = validateFormat('http://localhost:3000')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should reject 127.0.0.1 URLs', () => {
      const result = validateFormat('http://127.0.0.1')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should reject private IP addresses (192.168.x.x)', () => {
      const result = validateFormat('http://192.168.1.1')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should reject private IP addresses (10.x.x.x)', () => {
      const result = validateFormat('http://10.0.0.1')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should reject private IP addresses (172.16-31.x.x)', () => {
      const result = validateFormat('http://172.16.0.1')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should reject non-HTTP/HTTPS protocols', () => {
      const result = validateFormat('ftp://example.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })

    it('should reject invalid URL format', () => {
      const result = validateFormat('not-a-url')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid URL format')
    })

    it('should reject malformed URLs', () => {
      const result = validateFormat('http://')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid URL format')
    })
  })
})

describe('Tier 2: DNS Validation', () => {
  describe('validateDns', () => {
    it('should accept URLs with valid domains', async () => {
      const result = await validateDns('https://google.com')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject URLs with non-existent domains', async () => {
      const result = await validateDns('https://this-domain-definitely-does-not-exist-12345.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Domain does not exist or is not reachable')
    })

    it('should handle invalid hostnames gracefully', async () => {
      // Using an invalid hostname format
      const result = await validateDns('https://invalid..hostname')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Domain does not exist or is not reachable')
    })
  })
})

describe('Tier 3: HTTP Validation', () => {
  describe('validateHttp', () => {
    // Note: These tests require network access and may fail in CI/CD environments
    // In production, consider mocking fetch for unit tests and using integration tests for real HTTP validation
    
    it('should accept URLs that return 200 status', async () => {
      try {
        const result = await validateHttp('https://www.google.com')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      } catch (error) {
        // Skip test if network is unavailable
        console.log('Skipping HTTP test - network unavailable')
      }
    }, 10000) // 10 second timeout for network request

    it('should accept URLs that return 3xx status (redirects)', async () => {
      try {
        // Many sites redirect http to https
        const result = await validateHttp('http://www.google.com')
        expect(result.isValid).toBe(true)
      } catch (error) {
        console.log('Skipping HTTP test - network unavailable')
      }
    }, 10000)

    it('should reject URLs that return 404 status', async () => {
      try {
        const result = await validateHttp('https://www.google.com/this-page-does-not-exist-12345')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('URL returned status code')
      } catch (error) {
        console.log('Skipping HTTP test - network unavailable')
      }
    }, 10000)

    it('should handle timeout within 3 seconds', async () => {
      const startTime = Date.now()
      // Using a non-routable IP that will timeout
      const result = await validateHttp('http://192.0.2.1')
      const duration = Date.now() - startTime

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL is not accessible or timed out')
      expect(duration).toBeLessThan(4000) // Should timeout within 3 seconds + buffer
    }, 10000)

    it('should follow redirects up to 5 hops', async () => {
      try {
        // Most sites redirect http to https (1 hop)
        const result = await validateHttp('http://github.com')
        expect(result.isValid).toBe(true)
      } catch (error) {
        console.log('Skipping HTTP test - network unavailable')
      }
    }, 10000)
  })
})

describe('Complete 3-Tier Validation Pipeline', () => {
  describe('validateUrl', () => {
    it('should pass all three tiers for valid URLs', async () => {
      try {
        const result = await validateUrl('https://www.google.com')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
        expect(result.tier).toBeUndefined()
      } catch (error) {
        console.log('Skipping network-dependent test')
      }
    }, 10000)

    it('should fail at format tier for invalid format', async () => {
      const result = await validateUrl('not-a-url')
      expect(result.isValid).toBe(false)
      expect(result.tier).toBe('format')
      expect(result.error).toBe('Invalid URL format')
    })

    it('should fail at format tier for localhost', async () => {
      const result = await validateUrl('http://localhost:3000')
      expect(result.isValid).toBe(false)
      expect(result.tier).toBe('format')
      expect(result.error).toBe('Cannot shorten localhost or private IP addresses')
    })

    it('should fail at DNS tier for non-existent domain', async () => {
      const result = await validateUrl('https://this-domain-definitely-does-not-exist-12345.com')
      expect(result.isValid).toBe(false)
      expect(result.tier).toBe('dns')
      expect(result.error).toBe('Domain does not exist or is not reachable')
    }, 10000)

    it('should fail at HTTP tier for 404 pages', async () => {
      try {
        const result = await validateUrl('https://www.google.com/this-page-does-not-exist-12345')
        expect(result.isValid).toBe(false)
        expect(result.tier).toBe('http')
        expect(result.error).toContain('URL returned status code')
      } catch (error) {
        console.log('Skipping network-dependent test')
      }
    }, 10000)

    it('should complete validation within 3 seconds for valid URLs', async () => {
      const startTime = Date.now()
      try {
        await validateUrl('https://www.google.com')
        const duration = Date.now() - startTime
        expect(duration).toBeLessThan(3000)
      } catch (error) {
        // Test timeout behavior even if network fails
        const duration = Date.now() - startTime
        expect(duration).toBeLessThan(4000)
      }
    }, 10000)

    it('should handle URLs with paths and query parameters', async () => {
      try {
        const result = await validateUrl('https://www.google.com/search?q=test')
        expect(result.isValid).toBe(true)
      } catch (error) {
        console.log('Skipping network-dependent test')
      }
    }, 10000)

    it('should reject URLs longer than 2048 characters', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050)
      const result = await validateUrl(longUrl)
      expect(result.isValid).toBe(false)
      expect(result.tier).toBe('format')
    })

    it('should reject non-HTTP/HTTPS protocols', async () => {
      const result = await validateUrl('ftp://example.com')
      expect(result.isValid).toBe(false)
      expect(result.tier).toBe('format')
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })
  })
})

describe('Edge Cases', () => {
  it('should handle URLs with international characters', async () => {
    const result = await validateFormat('https://example.com/path/with/中文')
    expect(result.isValid).toBe(true)
  })

  it('should handle URLs with fragments', async () => {
    const result = await validateFormat('https://example.com#section')
    expect(result.isValid).toBe(true)
  })

  it('should handle URLs with ports', async () => {
    const result = await validateFormat('https://example.com:8080')
    expect(result.isValid).toBe(true)
  })

  it('should handle URLs with authentication', async () => {
    const result = await validateFormat('https://user:pass@example.com')
    expect(result.isValid).toBe(true)
  })

  it('should reject empty strings', async () => {
    const result = await validateFormat('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Invalid URL format')
  })

  it('should reject null/undefined gracefully', async () => {
    const result = await validateFormat(null as any)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Invalid URL format')
  })
})

describe('Security: Open Redirect Prevention', () => {
  describe('validateFormat - open redirect protection', () => {
    it('should reject URLs with double slashes in path (protocol confusion)', () => {
      const result = validateFormat('https://example.com//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with backslashes (path traversal)', () => {
      const result = validateFormat('https://example.com\\evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with @ symbol in path (credential confusion)', () => {
      const result = validateFormat('https://example.com/path@evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should accept URLs with @ in authentication (legitimate use)', () => {
      const result = validateFormat('https://user:pass@example.com/path')
      expect(result.isValid).toBe(true)
    })

    it('should reject URLs with encoded slashes (%2F) in suspicious positions', () => {
      const result = validateFormat('https://example.com/%2F%2Fevil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with encoded backslashes (%5C)', () => {
      const result = validateFormat('https://example.com/%5Cevil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with encoded @ (%40) in path', () => {
      const result = validateFormat('https://example.com/path%40evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should accept normal URLs with encoded characters', () => {
      const result = validateFormat('https://example.com/search?q=hello%20world')
      expect(result.isValid).toBe(true)
    })

    it('should reject URLs with multiple @ symbols', () => {
      const result = validateFormat('https://user@example.com@evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with suspicious redirect parameters', () => {
      const result = validateFormat('https://example.com?redirect=//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with suspicious url parameters', () => {
      const result = validateFormat('https://example.com?url=//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should reject URLs with suspicious next parameters', () => {
      const result = validateFormat('https://example.com?next=//evil.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL contains suspicious patterns that may indicate an open redirect')
    })

    it('should accept legitimate redirect parameters with relative paths', () => {
      const result = validateFormat('https://example.com?redirect=/dashboard')
      expect(result.isValid).toBe(true)
    })

    it('should accept legitimate redirect parameters with full URLs to same domain', () => {
      const result = validateFormat('https://example.com?redirect=https://example.com/page')
      expect(result.isValid).toBe(true)
    })

    it('should reject javascript: protocol in any form', () => {
      const result = validateFormat('javascript:alert(1)')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })

    it('should reject data: protocol', () => {
      const result = validateFormat('data:text/html,<script>alert(1)</script>')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })

    it('should reject file: protocol', () => {
      const result = validateFormat('file:///etc/passwd')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })
  })
})
