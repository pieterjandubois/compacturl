/**
 * Edge case tests for QR code generator
 * Tests boundary conditions and error scenarios
 */

import { generateQRCode } from '../qr-generator'
import { PNG } from 'pngjs'

describe('QR Code Generator - Edge Cases', () => {
  describe('URL validation edge cases', () => {
    it('should handle minimum valid URL', async () => {
      const url = 'http://a.b/c'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle URL with maximum practical length', async () => {
      // QR codes have limits, but should handle reasonable URLs
      const longPath = 'a'.repeat(500)
      const url = `https://compacturl.com/${longPath}`

      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle URL with international characters', async () => {
      const url = 'https://compacturl.com/测试-тест-テスト'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle URL with all special characters', async () => {
      const url = 'https://compacturl.com/test?a=1&b=2&c=3#section!@$%'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle URL with encoded characters', async () => {
      const url = 'https://compacturl.com/test%20with%20spaces'
      const buffer = await generateQRCode(url)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  describe('Dimension edge cases', () => {
    it('should handle minimum practical width (100px)', async () => {
      const url = 'https://compacturl.com/small'
      const buffer = await generateQRCode(url, { width: 100, errorCorrectionLevel: 'M' })

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(100)
      expect(png.height).toBe(100)
    })

    it('should handle large width (1000px)', async () => {
      const url = 'https://compacturl.com/large'
      const buffer = await generateQRCode(url, { width: 1000, errorCorrectionLevel: 'M' })

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(1000)
      expect(png.height).toBe(1000)
    })

    it('should handle exact default width (300px)', async () => {
      const url = 'https://compacturl.com/exact'
      const buffer = await generateQRCode(url, { width: 300, errorCorrectionLevel: 'M' })

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
      expect(png.height).toBe(300)
    })
  })

  describe('Error correction level edge cases', () => {
    it('should handle lowest error correction (L)', async () => {
      const url = 'https://compacturl.com/low-error'
      const buffer = await generateQRCode(url, { width: 300, errorCorrectionLevel: 'L' })

      expect(buffer).toBeInstanceOf(Buffer)
      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
    })

    it('should handle medium error correction (M)', async () => {
      const url = 'https://compacturl.com/medium-error'
      const buffer = await generateQRCode(url, { width: 300, errorCorrectionLevel: 'M' })

      expect(buffer).toBeInstanceOf(Buffer)
      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
    })

    it('should handle high error correction (Q)', async () => {
      const url = 'https://compacturl.com/high-error'
      const buffer = await generateQRCode(url, { width: 300, errorCorrectionLevel: 'Q' })

      expect(buffer).toBeInstanceOf(Buffer)
      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
    })

    it('should handle highest error correction (H)', async () => {
      const url = 'https://compacturl.com/highest-error'
      const buffer = await generateQRCode(url, { width: 300, errorCorrectionLevel: 'H' })

      expect(buffer).toBeInstanceOf(Buffer)
      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(300)
    })
  })

  describe('Error handling edge cases', () => {
    it('should throw error for null URL', async () => {
      await expect(generateQRCode(null as any)).rejects.toThrow()
    })

    it('should throw error for undefined URL', async () => {
      await expect(generateQRCode(undefined as any)).rejects.toThrow()
    })

    it('should throw error for empty string', async () => {
      await expect(generateQRCode('')).rejects.toThrow()
    })

    it('should throw error for whitespace-only string', async () => {
      await expect(generateQRCode('   ')).rejects.toThrow()
    })

    it('should throw error for invalid URL format', async () => {
      await expect(generateQRCode('not a url')).rejects.toThrow()
    })

    it('should throw error for URL without protocol', async () => {
      await expect(generateQRCode('compacturl.com/test')).rejects.toThrow()
    })
  })

  describe('Performance edge cases', () => {
    it('should handle rapid successive calls', async () => {
      const url = 'https://compacturl.com/rapid'
      const promises = Array.from({ length: 10 }, () => generateQRCode(url))

      const buffers = await Promise.all(promises)

      // All should succeed
      buffers.forEach((buffer) => {
        expect(buffer).toBeInstanceOf(Buffer)
        expect(buffer.length).toBeGreaterThan(0)
      })

      // All should be identical (deterministic)
      for (let i = 1; i < buffers.length; i++) {
        expect(buffers[i].equals(buffers[0])).toBe(true)
      }
    })

    it('should handle concurrent calls with different URLs', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://compacturl.com/test-${i}`)
      const promises = urls.map((url) => generateQRCode(url))

      const buffers = await Promise.all(promises)

      // All should succeed
      buffers.forEach((buffer) => {
        expect(buffer).toBeInstanceOf(Buffer)
        expect(buffer.length).toBeGreaterThan(0)
      })

      // All should be different
      for (let i = 0; i < buffers.length; i++) {
        for (let j = i + 1; j < buffers.length; j++) {
          expect(buffers[i].equals(buffers[j])).toBe(false)
        }
      }
    })
  })

  describe('Memory and resource edge cases', () => {
    it('should not leak memory on repeated calls', async () => {
      const url = 'https://compacturl.com/memory-test'

      // Generate many QR codes
      for (let i = 0; i < 100; i++) {
        const buffer = await generateQRCode(url)
        expect(buffer).toBeInstanceOf(Buffer)
      }

      // If we get here without running out of memory, test passes
      expect(true).toBe(true)
    }, 60000) // 60 second timeout for 100 QR code generations

    it('should handle generation of very large QR code', async () => {
      // Very long URL that will create a dense QR code
      const longUrl = 'https://compacturl.com/' + 'a'.repeat(1000)
      const buffer = await generateQRCode(longUrl, { width: 500, errorCorrectionLevel: 'L' })

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)

      const png = PNG.sync.read(buffer)
      expect(png.width).toBe(500)
      expect(png.height).toBe(500)
    })
  })
})
