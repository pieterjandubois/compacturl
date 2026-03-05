/**
 * QR Code Generator
 * Generates QR codes for shortened URLs
 * Requirements: 8.2, 8.4, 8.5, 8.6
 */

import QRCode from 'qrcode'

export interface QRCodeOptions {
  width: number
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
}

/**
 * Generates QR code for shortened URL
 * Always generates fresh (not cached)
 *
 * @param shortenedUrl - The shortened URL to encode in the QR code
 * @param options - QR code generation options
 * @returns PNG buffer containing the QR code image
 * @throws Error if URL is invalid or generation fails
 *
 * Requirements:
 * - 8.2: Generate QR code on-demand
 * - 8.4: PNG format with 300x300 pixel dimensions (default)
 * - 8.5: Error correction level M (medium, ~15% recovery)
 * - 8.6: Complete within 500ms
 */
export async function generateQRCode(
  shortenedUrl: string,
  options: QRCodeOptions = {
    width: 300,
    errorCorrectionLevel: 'M',
  }
): Promise<Buffer> {
  // Validate input
  if (!shortenedUrl || typeof shortenedUrl !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string')
  }

  // Trim whitespace
  const trimmedUrl = shortenedUrl.trim()

  if (trimmedUrl.length === 0) {
    throw new Error('Invalid URL: URL cannot be empty or whitespace-only')
  }

  // Basic URL format validation
  try {
    new URL(trimmedUrl)
  } catch (error) {
    throw new Error(`Invalid URL format: ${trimmedUrl}`)
  }

  try {
    // Generate QR code as PNG buffer
    const buffer = await QRCode.toBuffer(trimmedUrl, {
      width: options.width,
      errorCorrectionLevel: options.errorCorrectionLevel,
      type: 'png',
      margin: 1, // Minimal margin for cleaner appearance
    })

    return buffer
  } catch (error) {
    // Wrap qrcode library errors with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to generate QR code: ${errorMessage}`)
  }
}
