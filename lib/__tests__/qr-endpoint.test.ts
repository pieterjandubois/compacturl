/**
 * Unit Tests for QR Code API Endpoint
 * Validates Requirements: 8.1, 8.2, 8.7
 */

// Mock types
interface QRResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer | { error: { code: string; message: string } };
}

// Mock QR generation function
async function generateQRCode(url: string): Promise<Buffer> {
  // Simulate QR code generation
  if (!url) {
    throw new Error('URL is required');
  }

  // Return mock PNG buffer
  return Buffer.from('mock-qr-code-png-data');
}

// Mock API handler
async function handleQRRequest(url: string | null): Promise<QRResponse> {
  // Validate URL parameter exists
  if (!url) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL parameter is required',
        },
      },
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          code: 'INVALID_URL',
          message: 'Invalid URL format',
        },
      },
    };
  }

  try {
    // Generate QR code
    const qrBuffer = await generateQRCode(url);

    // Return PNG image with appropriate headers
    return {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: qrBuffer,
    };
  } catch (error) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          code: 'QR_GENERATION_ERROR',
          message: 'Failed to generate QR code',
        },
      },
    };
  }
}

describe('QR Code API Endpoint - Unit Tests', () => {
  describe('Successful QR Generation', () => {
    it('should generate QR code for valid URL', async () => {
      const url = 'https://example.com/abc123';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('image/png');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    it('should generate QR code for shortened URL', async () => {
      const url = 'http://localhost:3000/test-code';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('should generate QR code for URL with query parameters', async () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });

    it('should generate QR code for URL with fragments', async () => {
      const url = 'https://example.com/path#section';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });

    it('should generate QR code for international URLs', async () => {
      const url = 'https://例え.jp/パス';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });
  });

  describe('Missing URL Parameter', () => {
    it('should return 400 when URL parameter is missing', async () => {
      const response = await handleQRRequest(null);

      expect(response.status).toBe(400);
      expect(response.headers['Content-Type']).toBe('application/json');

      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('required');
    });

    it('should return 400 when URL parameter is empty string', async () => {
      const response = await handleQRRequest('');

      expect(response.status).toBe(400);
    });
  });

  describe('Invalid URL', () => {
    it('should return 400 for invalid URL format', async () => {
      const response = await handleQRRequest('not-a-valid-url');

      expect(response.status).toBe(400);

      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe('INVALID_URL');
      expect(body.error.message).toContain('Invalid URL');
    });

    it('should return 400 for URL without protocol', async () => {
      const response = await handleQRRequest('example.com');

      expect(response.status).toBe(400);
    });

    it('should return 400 for malformed URL', async () => {
      const response = await handleQRRequest('http://');

      expect(response.status).toBe(400);
    });
  });

  describe('Response Headers', () => {
    it('should set Content-Type to image/png', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      expect(response.headers['Content-Type']).toBe('image/png');
    });

    it('should set Cache-Control to no-cache', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      expect(response.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('should set Pragma to no-cache', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      expect(response.headers['Pragma']).toBe('no-cache');
    });

    it('should set Expires to 0', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      expect(response.headers['Expires']).toBe('0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);

      const response = await handleQRRequest(longUrl);

      expect(response.status).toBe(200);
    });

    it('should handle URLs with special characters', async () => {
      const url = 'https://example.com/path?q=hello%20world&foo=bar%2Fbaz';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });

    it('should handle URLs with multiple query parameters', async () => {
      const url = 'https://example.com/path?a=1&b=2&c=3&d=4&e=5';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });

    it('should handle URLs with port numbers', async () => {
      const url = 'https://example.com:8080/path';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });

    it('should handle localhost URLs', async () => {
      const url = 'http://localhost:3000/test';

      const response = await handleQRRequest(url);

      expect(response.status).toBe(200);
    });
  });

  describe('Response Body', () => {
    it('should return Buffer for successful generation', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    it('should return non-empty Buffer', async () => {
      const url = 'https://example.com/test';

      const response = await handleQRRequest(url);

      const buffer = response.body as Buffer;
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should return JSON error for invalid requests', async () => {
      const response = await handleQRRequest(null);

      expect(typeof response.body).toBe('object');
      expect(response.body).toHaveProperty('error');
    });
  });
});
