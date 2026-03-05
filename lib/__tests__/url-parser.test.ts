/**
 * Unit tests for URL parser utilities
 * Tests parseUrl and formatUrl functions
 */

import { parseUrl, formatUrl, UrlComponents } from '../url-parser'

describe('parseUrl', () => {
  describe('valid URLs', () => {
    it('should parse a simple HTTP URL', () => {
      const result = parseUrl('http://example.com')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('http:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('')
        expect(result.data.query).toBe('')
      }
    })

    it('should parse a simple HTTPS URL', () => {
      const result = parseUrl('https://example.com')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('')
        expect(result.data.query).toBe('')
      }
    })

    it('should parse URL with path', () => {
      const result = parseUrl('https://example.com/path/to/page')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('/path/to/page')
        expect(result.data.query).toBe('')
      }
    })

    it('should parse URL with query parameters', () => {
      const result = parseUrl('https://example.com?foo=bar&baz=qux')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('')
        expect(result.data.query).toBe('foo=bar&baz=qux')
      }
    })

    it('should parse URL with path and query', () => {
      const result = parseUrl('https://example.com/page?id=123')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('/page')
        expect(result.data.query).toBe('id=123')
      }
    })

    it('should parse URL with subdomain', () => {
      const result = parseUrl('https://www.example.com/page')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('www.example.com')
        expect(result.data.path).toBe('/page')
        expect(result.data.query).toBe('')
      }
    })

    it('should parse URL with port', () => {
      const result = parseUrl('https://example.com:8080/page')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com:8080')
        expect(result.data.path).toBe('/page')
        expect(result.data.query).toBe('')
      }
    })

    it('should parse URL with fragment', () => {
      const result = parseUrl('https://example.com/page#section')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.protocol).toBe('https:')
        expect(result.data.domain).toBe('example.com')
        expect(result.data.path).toBe('/page')
        expect(result.data.query).toBe('')
      }
    })
  })

  describe('invalid URLs', () => {
    it('should return error for empty string', () => {
      const result = parseUrl('')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format')
      }
    })

    it('should return error for invalid protocol', () => {
      const result = parseUrl('ftp://example.com')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('protocol')
        expect(result.error).toContain('http')
      }
    })

    it('should return error for missing protocol', () => {
      const result = parseUrl('example.com')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format')
      }
    })

    it('should return error for malformed URL', () => {
      const result = parseUrl('https://')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('domain')
      }
    })

    it('should return error for URL with spaces', () => {
      const result = parseUrl('https://example .com')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid URL format')
      }
    })
  })
})

describe('formatUrl', () => {
  it('should format URL with protocol and domain only', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com',
      path: '',
      query: '',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com')
  })

  it('should format URL with path', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com',
      path: '/path/to/page',
      query: '',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com/path/to/page')
  })

  it('should format URL with query', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com',
      path: '',
      query: 'foo=bar&baz=qux',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com?foo=bar&baz=qux')
  })

  it('should format URL with path and query', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com',
      path: '/page',
      query: 'id=123',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com/page?id=123')
  })

  it('should format URL with port', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com:8080',
      path: '/page',
      query: '',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com:8080/page')
  })

  it('should handle path without leading slash', () => {
    const components: UrlComponents = {
      protocol: 'https:',
      domain: 'example.com',
      path: 'page',
      query: '',
    }
    const result = formatUrl(components)
    expect(result).toBe('https://example.com/page')
  })
})

describe('round-trip property', () => {
  const testUrls = [
    'https://example.com',
    'http://example.com/path',
    'https://example.com/path?query=value',
    'https://www.example.com:8080/path?foo=bar',
    'https://api.example.com/v1/users?limit=10&offset=20',
  ]

  testUrls.forEach((url) => {
    it(`should maintain equivalence for ${url}`, () => {
      const parsed1 = parseUrl(url)
      expect(parsed1.success).toBe(true)

      if (parsed1.success) {
        const formatted = formatUrl(parsed1.data)
        const parsed2 = parseUrl(formatted)

        expect(parsed2.success).toBe(true)
        if (parsed2.success) {
          expect(parsed2.data).toEqual(parsed1.data)
        }
      }
    })
  })
})
