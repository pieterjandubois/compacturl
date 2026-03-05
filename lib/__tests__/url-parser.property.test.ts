/**
 * Property-based tests for URL parser utilities
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
 */

import * as fc from 'fast-check'
import { parseUrl, formatUrl } from '../url-parser'

describe('URL Parser Property-Based Tests', () => {
  /**
   * Property 1: Round-trip property
   * FOR ALL valid URL objects, parsing then printing then parsing SHALL produce an equivalent object
   * **Validates: Requirement 15.4**
   */
  it('round-trip property: parse(format(parse(url))) === parse(url)', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constantFrom('http:', 'https:'),
          domain: fc
            .tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('com', 'org', 'net', 'io')
            )
            .map(([name, tld]) => `${name}.${tld}`),
          path: fc.oneof(
            fc.constant(''),
            fc
              .array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 1, maxLength: 3 })
              .map((segments) => '/' + segments.join('/'))
          ),
          query: fc.oneof(
            fc.constant(''),
            fc
              .array(
                fc.tuple(
                  fc.stringMatching(/^[a-z0-9]+$/),
                  fc.stringMatching(/^[a-z0-9]+$/)
                ),
                { minLength: 1, maxLength: 3 }
              )
              .map((pairs) => pairs.map(([k, v]) => `${k}=${v}`).join('&'))
          ),
        }),
        (components) => {
          // Format components to URL string
          const url = formatUrl(components)

          // Parse the URL
          const parsed1 = parseUrl(url)
          expect(parsed1.success).toBe(true)

          if (parsed1.success) {
            // Format back to string
            const formatted = formatUrl(parsed1.data)

            // Parse again
            const parsed2 = parseUrl(formatted)
            expect(parsed2.success).toBe(true)

            if (parsed2.success) {
              // Components should be equivalent
              expect(parsed2.data).toEqual(parsed1.data)
            }
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property 2: Parse determinism
   * FOR ALL URLs, parsing the same URL multiple times SHALL produce the same result
   * **Validates: Requirement 15.1**
   */
  it('parsing is deterministic', () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ['http', 'https'] }), (url) => {
        const result1 = parseUrl(url)
        const result2 = parseUrl(url)

        expect(result1).toEqual(result2)
      }),
      { numRuns: 5 }
    )
  })

  /**
   * Property 3: Format determinism
   * FOR ALL URL components, formatting the same components multiple times SHALL produce the same result
   * **Validates: Requirement 15.3**
   */
  it('formatting is deterministic', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constantFrom('http:', 'https:'),
          domain: fc
            .tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('com', 'org', 'net')
            )
            .map(([name, tld]) => `${name}.${tld}`),
          path: fc.oneof(fc.constant(''), fc.stringMatching(/^\/[a-z0-9/-]*$/)),
          query: fc.oneof(fc.constant(''), fc.stringMatching(/^[a-z0-9=&]+$/)),
        }),
        (components) => {
          const result1 = formatUrl(components)
          const result2 = formatUrl(components)

          expect(result1).toBe(result2)
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property 4: Valid URLs always parse successfully
   * FOR ALL valid HTTP/HTTPS URLs, parsing SHALL succeed
   * **Validates: Requirement 15.1**
   */
  it('valid URLs parse successfully', () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ['http', 'https'] }), (url) => {
        const result = parseUrl(url)
        expect(result.success).toBe(true)
      }),
      { numRuns: 5 }
    )
  })

  /**
   * Property 5: Invalid protocols are rejected
   * FOR ALL URLs with non-HTTP/HTTPS protocols, parsing SHALL fail with descriptive error
   * **Validates: Requirement 15.2**
   */
  it('invalid protocols are rejected with descriptive error', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ftp', 'file', 'ws', 'wss', 'mailto'),
        fc.domain(),
        (protocol, domain) => {
          const url = `${protocol}://${domain}`
          const result = parseUrl(url)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toContain('protocol')
            expect(result.error.toLowerCase()).toContain('http')
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property 6: Formatted URLs are valid
   * FOR ALL valid URL components, the formatted URL SHALL be parseable
   * **Validates: Requirements 15.1, 15.3**
   */
  it('formatted URLs are parseable', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constantFrom('http:', 'https:'),
          domain: fc
            .tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('com', 'org', 'net')
            )
            .map(([name, tld]) => `${name}.${tld}`),
          path: fc.oneof(
            fc.constant(''),
            fc
              .array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 1, maxLength: 3 })
              .map((segments) => '/' + segments.join('/'))
          ),
          query: fc.constant(''),
        }),
        (components) => {
          const formatted = formatUrl(components)
          const parsed = parseUrl(formatted)

          expect(parsed.success).toBe(true)
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property 7: Empty domain is rejected
   * FOR ALL URLs with empty domain, parsing SHALL fail with descriptive error
   * **Validates: Requirement 15.2**
   */
  it('empty domain is rejected', () => {
    fc.assert(
      fc.property(fc.constantFrom('http:', 'https:'), (protocol) => {
        const url = `${protocol}//`
        const result = parseUrl(url)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.toLowerCase()).toContain('domain')
        }
      }),
      { numRuns: 5 }
    )
  })

  /**
   * Property 8: Query parameters are preserved
   * FOR ALL URLs with query parameters, parsing SHALL preserve the query string
   * **Validates: Requirement 15.1**
   */
  it('query parameters are preserved', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ validSchemes: ['http', 'https'] }),
        fc
          .array(
            fc.tuple(
              fc.stringMatching(/^[a-z0-9]+$/),
              fc.stringMatching(/^[a-z0-9]+$/)
            ),
            { minLength: 1, maxLength: 3 }
          )
          .map((pairs) => pairs.map(([k, v]) => `${k}=${v}`).join('&')),
        (baseUrl, queryString) => {
          const url = `${baseUrl}?${queryString}`
          const result = parseUrl(url)

          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.query).toBe(queryString)
          }
        }
      ),
      { numRuns: 5 }
    )
  })
})
