/**
 * Unit tests for QR code generator
 * Tests basic functionality and edge cases
 */

import { generateQRCode } from '../qr-generator'
import { PNG } from 'pngjs'

describe('QR Code Generator - Unit Tests', () => {
  describe('generateQRCode', () => {
    it('should generate a QR code for a valid URL', async () => {
      const url = 'https://compacturl.com/test-123'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should generate a PNG image', async () => {
      const url = 'https://compacturl.com/test-456'
      const buffer = await generateQRCode(url)

      // Verify PNG signature (first 8 bytes)
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      expect(buffer.subarray(0, 8)).toEqual(pngSignature)
    })

    it('should generate QR code with 300x300 dimensions', async () => {
      const url = 'https://compacturl.com/test-789'
      const buffer = await generateQRCode(url)

      // Parse PNG to verify dimensions
      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
      expect(png.height).toBe(300)
    })

    it('should complete within 500ms', async () => {
      const url = 'https://compacturl.com/performance-test'
      const startTime = Date.now()

      await generateQRCode(url)

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(500)
    })

    it('should handle URLs with special characters', async () => {
      const url = 'https://compacturl.com/test?param=value&foo=bar#section'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(100)
      const url = `https://compacturl.com/${longPath}`
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should throw error for empty URL', async () => {
      await expect(generateQRCode('')).rejects.toThrow()
    })

    it('should throw error for invalid URL format', async () => {
      await expect(generateQRCode('not-a-url')).rejects.toThrow()
    })

    it('should generate different QR codes for different URLs', async () => {
      const url1 = 'https://compacturl.com/test-1'
      const url2 = 'https://compacturl.com/test-2'

      const buffer1 = await generateQRCode(url1)
      const buffer2 = await generateQRCode(url2)

      // QR codes should be different
      expect(buffer1.equals(buffer2)).toBe(false)
    })

    it('should generate identical QR codes for the same URL', async () => {
      const url = 'https://compacturl.com/test-same'

      const buffer1 = await generateQRCode(url)
      const buffer2 = await generateQRCode(url)

      // QR codes should be identical (deterministic)
      expect(buffer1.equals(buffer2)).toBe(true)
    })
  })

  describe('generateQRCode with custom options', () => {
    it('should respect custom width option', async () => {
      const url = 'https://compacturl.com/custom-size'
      const buffer = await generateQRCode(url, { width: 400, errorCorrectionLevel: 'M' })

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(400)
      expect(png.height).toBe(400)
    })

    it('should use default options when not provided', async () => {
      const url = 'https://compacturl.com/default-options'
      const buffer = await generateQRCode(url)

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
      expect(png.height).toBe(300)
    })
  })
})
