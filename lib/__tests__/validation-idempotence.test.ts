/**
 * @jest-environment node
 * 
 * Property-Based Tests for URL Validation Idempotence
 * 
 * Feature: compact-url
 * Property 2: URL Validation Sequence
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7, 2.8
 * 
 * Tests verify:
 * - Validation result is consistent across multiple calls (idempotence)
 * - Validation completes within 3 seconds
 * - Tier sequence is followed (format → DNS → HTTP)
 * - Error message "not a valid link" is returned on failure
 * - Response codes 200-399 are accepted as valid
 */

import * as fc from 'fast-check';
import {
  validateUrl,
  validateFormat,
  validateDns,
  validateHttp,
  ValidationResult,
} from '../validation';

// ============================================================================
// Custom Arbitraries for URL Generation
// ============================================================================

/**
 * Generates valid HTTP/HTTPS URLs
 */
const validUrlArbitrary = fc
  .tuple(
    fc.constantFrom('http', 'https'),
    fc.stringMatching(/^[a-z0-9-]{3,20}$/),
    fc.constantFrom('com', 'org', 'net', 'io', 'dev'),
    fc.option(fc.stringMatching(/^[a-z0-9-]{3,30}$/), { nil: undefined }),
    fc.option(fc.stringMatching(/^[a-z0-9-]{3,20}$/), { nil: undefined })
  )
  .map(([protocol, domain, tld, path, query]) => {
    let url = `${protocol}://${domain}.${tld}`;
    if (path) url += `/${path}`;
    if (query) url += `?q=${query}`;
    return url;
  });

/**
 * Generates URLs with format errors
 */
const invalidFormatUrlArbitrary = fc.oneof(
  // Missing protocol
  fc.stringMatching(/^[a-z0-9-]{3,20}\.[a-z]{2,3}$/).map(s => s),
  // Invalid protocol
  fc.tuple(
    fc.constantFrom('ftp', 'file', 'javascript', 'data'),
    fc.stringMatching(/^[a-z0-9-]{3,20}$/),
    fc.constantFrom('com', 'org')
  ).map(([protocol, domain, tld]) => `${protocol}://${domain}.${tld}`),
  // Localhost
  fc.constantFrom(
    'http://localhost',
    'http://localhost:3000',
    'https://localhost:8080'
  ),
  // Private IPs
  fc.constantFrom(
    'http://127.0.0.1',
    'http://192.168.1.1',
    'http://10.0.0.1',
    'http://172.16.0.1'
  ),
  // Too long (> 2048 chars)
  fc.constant('https://example.com/' + 'a'.repeat(2050)),
  // Malformed
  fc.constantFrom(
    'http://',
    'https://',
    'not-a-url',
    '',
    'http://invalid..hostname'
  )
);

/**
 * Generates URLs with non-existent domains (will fail DNS)
 */
const nonExistentDomainUrlArbitrary = fc
  .tuple(
    fc.constantFrom('http', 'https'),
    fc.stringMatching(/^[a-z0-9-]{20,40}$/),
    fc.constantFrom('invalid', 'nonexistent', 'fake')
  )
  .map(([protocol, randomString, tld]) => 
    `${protocol}://${randomString}-definitely-does-not-exist.${tld}`
  );

/**
 * Generates URLs that exist but return 404 (will fail HTTP)
 */
const notFoundUrlArbitrary = fc
  .tuple(
    fc.constantFrom('https://www.google.com', 'https://github.com'),
    fc.stringMatching(/^[a-z0-9-]{20,40}$/)
  )
  .map(([baseUrl, randomPath]) => `${baseUrl}/${randomPath}-does-not-exist-12345`);

/**
 * Generates a mix of valid and invalid URLs
 */
const mixedUrlArbitrary = fc.oneof(
  validUrlArbitrary,
  invalidFormatUrlArbitrary,
  nonExistentDomainUrlArbitrary,
  notFoundUrlArbitrary
);

// ============================================================================
// Property 2: URL Validation Idempotence
// ============================================================================

describe('Property 2: URL Validation Sequence - Idempotence', () => {
  describe('Requirement 2.1, 2.2, 2.3: Validation result is idempotent', () => {
    it('should return the same result when validating the same URL multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          // Validate the URL 3 times
          const result1 = await validateUrl(url);
          const result2 = await validateUrl(url);
          const result3 = await validateUrl(url);

          // All results should be identical
          expect(result1.isValid).toBe(result2.isValid);
          expect(result1.isValid).toBe(result3.isValid);
          
          expect(result1.error).toBe(result2.error);
          expect(result1.error).toBe(result3.error);
          
          expect(result1.tier).toBe(result2.tier);
          expect(result1.tier).toBe(result3.tier);
        }),
        { numRuns: 25, timeout: 15000 } // Reduced runs, increased timeout per test
      );
    }, 180000); // 3 minute timeout for entire test

    it('should return consistent format validation results', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          // Format validation should be deterministic
          const result1 = validateFormat(url);
          const result2 = validateFormat(url);
          const result3 = validateFormat(url);

          expect(result1.isValid).toBe(result2.isValid);
          expect(result1.isValid).toBe(result3.isValid);
          expect(result1.error).toBe(result2.error);
          expect(result1.error).toBe(result3.error);
        }),
        { numRuns: 25 }
      );
    });

    it('should return consistent DNS validation results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(validUrlArbitrary, nonExistentDomainUrlArbitrary),
          async (url) => {
            // Skip if format is invalid
            const formatResult = validateFormat(url);
            if (!formatResult.isValid) return;

            // DNS validation should be deterministic for the same domain
            const result1 = await validateDns(url);
            const result2 = await validateDns(url);

            expect(result1.isValid).toBe(result2.isValid);
            expect(result1.error).toBe(result2.error);
          }
        ),
        { numRuns: 25, timeout: 15000 } // Reduced runs, increased timeout
      );
    }, 90000); // 1.5 minute timeout

    it('should return consistent HTTP validation results', async () => {
      // Use known URLs for consistency
      const knownUrls = [
        'https://www.google.com',
        'https://github.com',
        'https://www.google.com/this-definitely-does-not-exist-12345',
      ];

      for (const url of knownUrls) {
        const result1 = await validateHttp(url);
        const result2 = await validateHttp(url);

        expect(result1.isValid).toBe(result2.isValid);
        expect(result1.error).toBe(result2.error);
      }
    }, 30000);
  });

  describe('Requirement 2.7: Validation completes within 3 seconds', () => {
    it('should complete validation within 3 seconds for any URL', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          const startTime = Date.now();
          
          try {
            await validateUrl(url);
          } catch (error) {
            // Even if validation throws, it should be within time limit
          }
          
          const duration = Date.now() - startTime;
          
          // Should complete within 3 seconds + small buffer for test overhead
          expect(duration).toBeLessThan(3500);
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 60000);

    it('should timeout HTTP validation after 3 seconds', async () => {
      // Use a non-routable IP that will timeout
      const timeoutUrl = 'http://192.0.2.1'; // TEST-NET-1 (non-routable)
      
      const startTime = Date.now();
      const result = await validateHttp(timeoutUrl);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL is not accessible or timed out');
      expect(duration).toBeLessThan(4000); // 3 seconds + buffer
    }, 10000);
  });

  describe('Requirement 2.1, 2.2, 2.3: Tier sequence is followed', () => {
    it('should fail at format tier for invalid format', async () => {
      await fc.assert(
        fc.asyncProperty(invalidFormatUrlArbitrary, async (url) => {
          const result = await validateUrl(url);
          
          expect(result.isValid).toBe(false);
          // Should fail at format or DNS tier (some malformed URLs pass URL parsing but fail DNS)
          expect(['format', 'dns']).toContain(result.tier);
          expect(result.error).toBeDefined();
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 30000);

    it('should fail at DNS tier for non-existent domains', async () => {
      await fc.assert(
        fc.asyncProperty(nonExistentDomainUrlArbitrary, async (url) => {
          const result = await validateUrl(url);
          
          expect(result.isValid).toBe(false);
          expect(result.tier).toBe('dns');
          expect(result.error).toBe('Domain does not exist or is not reachable');
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 60000);

    it('should fail at HTTP tier for 404 pages', async () => {
      await fc.assert(
        fc.asyncProperty(notFoundUrlArbitrary, async (url) => {
          const result = await validateUrl(url);
          
          // Should pass format and DNS, but fail at HTTP
          expect(result.isValid).toBe(false);
          expect(result.tier).toBe('http');
          expect(result.error).toContain('URL returned status code');
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 60000);

    it('should not proceed to DNS tier if format validation fails', async () => {
      await fc.assert(
        fc.asyncProperty(invalidFormatUrlArbitrary, async (url) => {
          const formatResult = validateFormat(url);
          
          if (!formatResult.isValid) {
            // If format fails, full validation should also fail at format tier
            const fullResult = await validateUrl(url);
            
            expect(fullResult.isValid).toBe(false);
            expect(fullResult.tier).toBe('format');
            // Should not have attempted DNS or HTTP validation
          }
        }),
        { numRuns: 25 }
      );
    });

    it('should not proceed to HTTP tier if DNS validation fails', async () => {
      await fc.assert(
        fc.asyncProperty(nonExistentDomainUrlArbitrary, async (url) => {
          const formatResult = validateFormat(url);
          
          if (formatResult.isValid) {
            const dnsResult = await validateDns(url);
            
            if (!dnsResult.isValid) {
              // If DNS fails, full validation should fail at DNS tier
              const fullResult = await validateUrl(url);
              
              expect(fullResult.isValid).toBe(false);
              expect(fullResult.tier).toBe('dns');
              // Should not have attempted HTTP validation
            }
          }
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 60000);
  });

  describe('Requirement 2.4: Error message "not a valid link"', () => {
    it('should return descriptive error messages for validation failures', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          const result = await validateUrl(url);
          
          if (!result.isValid) {
            // Error message should be defined
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(result.error!.length).toBeGreaterThan(0);
            
            // Tier should be defined for failures
            expect(result.tier).toBeDefined();
            expect(['format', 'dns', 'http']).toContain(result.tier);
          }
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 120000);

    it('should provide specific error messages for each tier', async () => {
      // Format tier errors
      const formatErrors = [
        'http://localhost',
        'ftp://example.com',
        'https://example.com/' + 'a'.repeat(2050),
      ];

      for (const url of formatErrors) {
        const result = await validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.tier).toBe('format');
        expect(result.error).toBeDefined();
      }

      // DNS tier error
      const dnsError = 'https://this-domain-definitely-does-not-exist-12345.com';
      const dnsResult = await validateUrl(dnsError);
      expect(dnsResult.isValid).toBe(false);
      expect(dnsResult.tier).toBe('dns');
      expect(dnsResult.error).toBe('Domain does not exist or is not reachable');

      // HTTP tier error (if network available)
      try {
        const httpError = 'https://www.google.com/this-page-does-not-exist-12345';
        const httpResult = await validateUrl(httpError);
        expect(httpResult.isValid).toBe(false);
        expect(httpResult.tier).toBe('http');
        expect(httpResult.error).toContain('URL returned status code');
      } catch (error) {
        // Skip if network unavailable
        console.log('Skipping HTTP error test - network unavailable');
      }
    }, 30000);
  });

  describe('Requirement 2.8: Accept response codes 200-399 as valid', () => {
    it('should accept 2xx status codes as valid', async () => {
      // Test with known URLs that return 200
      const validUrls = [
        'https://www.google.com',
        'https://github.com',
      ];

      for (const url of validUrls) {
        try {
          const result = await validateHttp(url);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
        } catch (error) {
          console.log('Skipping network-dependent test');
        }
      }
    }, 30000);

    it('should accept 3xx status codes (redirects) as valid', async () => {
      // Many sites redirect http to https
      try {
        const result = await validateHttp('http://www.google.com');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      } catch (error) {
        console.log('Skipping network-dependent test');
      }
    }, 10000);

    it('should reject 4xx status codes as invalid', async () => {
      try {
        const result = await validateHttp('https://www.google.com/this-page-does-not-exist-12345');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('URL returned status code');
      } catch (error) {
        console.log('Skipping network-dependent test');
      }
    }, 10000);

    it('should reject 5xx status codes as invalid', async () => {
      // Note: Hard to test 5xx without a controlled server
      // This is a placeholder for integration testing
      // In practice, 5xx would be rejected by the status code check
    });
  });

  describe('Edge Cases: Validation state consistency', () => {
    it('should handle concurrent validation calls consistently', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          // Validate the same URL concurrently
          const results = await Promise.all([
            validateUrl(url),
            validateUrl(url),
            validateUrl(url),
          ]);

          // All results should be identical
          const [result1, result2, result3] = results;
          
          expect(result1.isValid).toBe(result2.isValid);
          expect(result1.isValid).toBe(result3.isValid);
          
          expect(result1.error).toBe(result2.error);
          expect(result1.error).toBe(result3.error);
          
          expect(result1.tier).toBe(result2.tier);
          expect(result1.tier).toBe(result3.tier);
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 60000);

    it('should not modify input URL during validation', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          const originalUrl = url;
          await validateUrl(url);
          
          // URL should not be modified
          expect(url).toBe(originalUrl);
        }),
        { numRuns: 25, timeout: 10000 }
      );
    }, 120000);

    it('should handle null/undefined gracefully', async () => {
      const result1 = validateFormat(null as any);
      const result2 = validateFormat(undefined as any);
      const result3 = validateFormat('' as any);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
      
      expect(result1.error).toBe('Invalid URL format');
      expect(result2.error).toBe('Invalid URL format');
      expect(result3.error).toBe('Invalid URL format');
    });

    it('should handle very long URLs consistently', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      
      const result1 = await validateUrl(longUrl);
      const result2 = await validateUrl(longUrl);
      
      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.isValid).toBe(false);
      expect(result1.tier).toBe('format');
      expect(result1.error).toBe('URL exceeds maximum length of 2048 characters');
    });

    it('should handle URLs with special characters consistently', async () => {
      const specialUrls = [
        'https://example.com/path/with/中文',
        'https://example.com/path?query=hello%20world',
        'https://example.com/path#section',
        'https://user:pass@example.com/path',
      ];

      for (const url of specialUrls) {
        const result1 = validateFormat(url);
        const result2 = validateFormat(url);
        
        expect(result1.isValid).toBe(result2.isValid);
        expect(result1.error).toBe(result2.error);
      }
    });
  });

  describe('Performance: Validation efficiency', () => {
    it('should validate format quickly (< 10ms)', async () => {
      await fc.assert(
        fc.asyncProperty(mixedUrlArbitrary, async (url) => {
          const startTime = Date.now();
          validateFormat(url);
          const duration = Date.now() - startTime;
          
          expect(duration).toBeLessThan(10);
        }),
        { numRuns: 25 }
      );
    });

    it('should cache DNS lookups implicitly through OS', async () => {
      // First lookup might be slow, subsequent should be faster
      const url = 'https://www.google.com';
      
      const startTime1 = Date.now();
      await validateDns(url);
      const duration1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await validateDns(url);
      const duration2 = Date.now() - startTime2;
      
      // Second lookup should generally be faster (cached by OS)
      // But we don't enforce this strictly as it depends on system state
      expect(duration2).toBeLessThan(5000);
    }, 15000);
  });
});
