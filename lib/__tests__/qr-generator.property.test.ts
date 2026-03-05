/**
 * Property-based tests for QR code generator
 * **Property 8: QR Code Generation**
 * **Validates: Requirements 8.2, 8.4, 8.5, 8.8**
 * Tag: Feature: compact-url, Property 8: QR Code Generation
 */

import * as fc from 'fast-check'
import { generateQRCode } from '../qr-generator'
import { PNG } from 'pngjs'

describe('QR Code Generator - Property-Based Tests', () => {
  // Increase timeout for property-based tests (100+ iterations)
  jest.setTimeout(120000) // 120 seconds

  describe('Property 8: QR Code Generation', () => {
    it('should generate valid PNG for any valid shortened URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            domain: fc.constantFrom('compacturl.com', 'short.ly', 'tiny.url'),
            shortCode: fc.stringMatching(/^[a-z0-9-]{1,15}$/),
          }),
          async ({ domain, shortCode }) => {
            const url = `https://${domain}/${shortCode}`

            const buffer = await generateQRCode(url)

            // Property: Result is a valid Buffer
            expect(buffer).toBeInstanceOf(Buffer)
            expect(buffer.length).toBeGreaterThan(0)

            // Property: Buffer contains valid PNG signature
            const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
            expect(buffer.subarray(0, 8)).toEqual(pngSignature)

            // Property: PNG can be parsed successfully
            expect(() => PNG.sync.read(buffer)).not.toThrow()
          }
        ),
        { numRuns: 25 }
      )
    })

    it('should generate QR codes with correct dimensions (300x300)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.domain(),
            path: fc.stringMatching(/^[a-z0-9-]{1,20}$/),
          }),
          async ({ protocol, domain, path }) => {
            const url = `${protocol}://${domain}/${path}`

            const buffer = await generateQRCode(url)
            const png = PNG.sync.read(buffer)

            // Property: Dimensions are always 300x300 (default)
            expect(png.width).toBe(300)
            expect(png.height).toBe(300)
          }
        ),
        { numRuns: 25 }
      )
    })

    it('should complete generation within 500ms for any URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const startTime = Date.now()

            await generateQRCode(url)

            const duration = Date.now() - startTime

            // Property: Generation completes within 500ms (Requirement 8.6)
            expect(duration).toBeLessThan(500)
          }
        ),
        { numRuns: 25 } // Fewer runs for performance test
      )
    })

    it('should be deterministic - same URL produces same QR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const buffer1 = await generateQRCode(url)
            const buffer2 = await generateQRCode(url)

            // Property: Deterministic generation
            expect(buffer1.equals(buffer2)).toBe(true)
          }
        ),
        { numRuns: 25 } // Reduced runs for performance (generates 2 QR codes per run)
      )
    })

    it('should generate different QR codes for different URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(fc.webUrl(), fc.webUrl()).filter(([url1, url2]) => url1 !== url2),
          async ([url1, url2]) => {
            const buffer1 = await generateQRCode(url1)
            const buffer2 = await generateQRCode(url2)

            // Property: Different URLs produce different QR codes
            expect(buffer1.equals(buffer2)).toBe(false)
          }
        ),
        { numRuns: 25 } // Reduced runs for performance (generates 2 QR codes per run)
      )
    })

    it('should handle URLs with various query parameters and fragments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.webUrl(),
            queryParams: fc.dictionary(
              fc.stringMatching(/^[a-z]{1,10}$/),
              fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
            ),
            fragment: fc.option(fc.stringMatching(/^[a-z0-9-]{1,15}$/), { nil: null }),
          }),
          async ({ baseUrl, queryParams, fragment }) => {
            const params = new URLSearchParams(queryParams).toString()
            const url = `${baseUrl}${params ? '?' + params : ''}${fragment ? '#' + fragment : ''}`

            const buffer = await generateQRCode(url)

            // Property: Successfully generates QR code for complex URLs
            expect(buffer).toBeInstanceOf(Buffer)
            expect(buffer.length).toBeGreaterThan(0)

            const png = PNG.sync.read(buffer)
            expect(png.width).toBe(300)
            expect(png.height).toBe(300)
          }
        ),
        { numRuns: 25 }
      )
    })

    it('should respect custom width option', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            width: fc.integer({ min: 100, max: 1000 }),
          }),
          async ({ url, width }) => {
            const buffer = await generateQRCode(url, { width, errorCorrectionLevel: 'M' })
            const png = PNG.sync.read(buffer)

            // Property: Custom width is respected (within reasonable tolerance)
            // QR codes are made of modules, so exact width may vary slightly
            const tolerance = 10 // Allow up to 10 pixels difference
            expect(Math.abs(png.width - width)).toBeLessThanOrEqual(tolerance)
            expect(Math.abs(png.height - width)).toBeLessThanOrEqual(tolerance) // QR codes are square
          }
        ),
        { numRuns: 25 }
      )
    })

    it('should handle error correction levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            errorLevel: fc.constantFrom('L', 'M', 'Q', 'H'),
          }),
          async ({ url, errorLevel }) => {
            const buffer = await generateQRCode(url, {
              width: 300,
              errorCorrectionLevel: errorLevel as 'L' | 'M' | 'Q' | 'H',
            })

            // Property: QR code is generated successfully with any error correction level
            expect(buffer).toBeInstanceOf(Buffer)
            expect(buffer.length).toBeGreaterThan(0)

            const png = PNG.sync.read(buffer)
            expect(png.width).toBe(300)
            expect(png.height).toBe(300)
          }
        ),
        { numRuns: 25 }
      )
    })
  })
})
