/**
 * Edge Case Unit Tests for Smart Naming Engine
 * 
 * This test suite focuses on edge cases and boundary conditions for the smart naming utilities.
 * Tests cover scenarios that might not be caught by property-based tests.
 * 
 * **Validates: Requirements 1.3, 1.4, 1.9**
 * 
 * Test Categories:
 * 1. URLs without paths
 * 2. URLs with very long paths
 * 3. URLs with special characters
 * 4. Subdomain handling (www, blog, api, m, mobile)
 * 5. Numeric suffix generation (collision handling)
 */

import { 
  extractDomain, 
  extractLastPathSegment, 
  sanitizeShortCode, 
  generateSmartShortCode 
} from '../smart-naming';

describe('Edge Cases: URLs without paths', () => {
  describe('extractLastPathSegment - no path scenarios', () => {
    it('should return empty string for root URL', () => {
      const url = new URL('https://example.com/');
      expect(extractLastPathSegment(url)).toBe('');
    });

    it('should return empty string for URL without path', () => {
      const url = new URL('https://example.com');
      expect(extractLastPathSegment(url)).toBe('');
    });

    it('should return empty string for URL with only query params', () => {
      const url = new URL('https://example.com?query=value');
      expect(extractLastPathSegment(url)).toBe('');
    });

    it('should return empty string for URL with only hash', () => {
      const url = new URL('https://example.com#section');
      expect(extractLastPathSegment(url)).toBe('');
    });

    it('should return empty string for URL with query and hash but no path', () => {
      const url = new URL('https://example.com?query=value#section');
      expect(extractLastPathSegment(url)).toBe('');
    });
  });

  describe('generateSmartShortCode - no path scenarios', () => {
    const mockPrisma = {
      link: {
        findUnique: jest.fn(),
      },
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate short code from domain only when no path', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(1);
    });

    it('should handle root path same as no path', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should use domain only when path is just query params', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com?search=test', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should use domain only when path is just hash', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com#top', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });
  });
});

describe('Edge Cases: URLs with very long paths', () => {
  describe('extractLastPathSegment - long path scenarios', () => {
    it('should extract last segment from extremely long path', () => {
      const longPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/final-segment';
      const url = new URL(`https://example.com${longPath}`);
      expect(extractLastPathSegment(url)).toBe('final-segment');
    });

    it('should handle very long segment name', () => {
      const longSegment = 'this-is-a-very-long-segment-name-that-exceeds-normal-length-expectations-and-keeps-going';
      const url = new URL(`https://example.com/path/${longSegment}`);
      expect(extractLastPathSegment(url)).toBe(longSegment);
    });

    it('should handle path with 100+ segments', () => {
      const segments = Array.from({ length: 100 }, (_, i) => `segment${i}`);
      const path = '/' + segments.join('/');
      const url = new URL(`https://example.com${path}`);
      expect(extractLastPathSegment(url)).toBe('segment99');
    });

    it('should handle deeply nested path with long segment names', () => {
      const url = new URL('https://example.com/very-long-category-name/subcategory-with-long-name/product-with-extremely-long-descriptive-name');
      expect(extractLastPathSegment(url)).toBe('product-with-extremely-long-descriptive-name');
    });
  });

  describe('sanitizeShortCode - long code truncation', () => {
    it('should truncate very long codes to 10 characters', () => {
      const longCode = 'this-is-an-extremely-long-short-code-that-needs-truncation';
      // Truncates to 10 chars, but breaks at last hyphen in second half (position 7)
      expect(sanitizeShortCode(longCode)).toBe('this-is');
      expect(sanitizeShortCode(longCode).length).toBeLessThanOrEqual(10);
    });

    it('should truncate at word boundary for long codes', () => {
      const longCode = 'example-very-long-code-name';
      const result = sanitizeShortCode(longCode);
      expect(result.length).toBeLessThanOrEqual(10);
      // Should break at hyphen if possible
      expect(result).toBe('example');
    });

    it('should handle 50+ character codes', () => {
      const veryLongCode = 'a'.repeat(50) + '-' + 'b'.repeat(50);
      const result = sanitizeShortCode(veryLongCode);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should handle custom maxLength for very long codes', () => {
      const longCode = 'verylongcode-with-many-segments';
      expect(sanitizeShortCode(longCode, 5).length).toBeLessThanOrEqual(5);
      expect(sanitizeShortCode(longCode, 15).length).toBeLessThanOrEqual(15);
      expect(sanitizeShortCode(longCode, 20).length).toBeLessThanOrEqual(20);
    });
  });

  describe('generateSmartShortCode - long path scenarios', () => {
    const mockPrisma = {
      link: {
        findUnique: jest.fn(),
      },
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle URL with very long path', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const longPath = '/category/subcategory/product-with-very-long-descriptive-name-that-exceeds-limits';
      const result = await generateSmartShortCode(`https://example.com${longPath}`, mockPrisma);

      expect(result.shortCode.length).toBeLessThanOrEqual(10);
      expect(result.isUnique).toBe(true);
    });

    it('should truncate combined domain-path when too long', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://verylongdomainname.com/verylongpathsegment', mockPrisma);

      expect(result.shortCode.length).toBeLessThanOrEqual(10);
      expect(result.isUnique).toBe(true);
    });

    it('should handle 100-character path segment', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const longSegment = 'a'.repeat(100);
      const result = await generateSmartShortCode(`https://example.com/${longSegment}`, mockPrisma);

      expect(result.shortCode.length).toBeLessThanOrEqual(10);
      expect(result.isUnique).toBe(true);
    });
  });
});

describe('Edge Cases: URLs with special characters', () => {
  describe('extractLastPathSegment - special characters', () => {
    it('should handle URL-encoded characters', () => {
      const url = new URL('https://example.com/hello%20world');
      expect(extractLastPathSegment(url)).toBe('hello%20world');
    });

    it('should handle multiple encoded characters', () => {
      const url = new URL('https://example.com/path%2Fwith%2Fslashes');
      expect(extractLastPathSegment(url)).toBe('path%2Fwith%2Fslashes');
    });

    it('should handle unicode characters in path', () => {
      const url = new URL('https://example.com/café-résumé');
      // URL automatically encodes unicode characters
      expect(extractLastPathSegment(url)).toBe('caf%C3%A9-r%C3%A9sum%C3%A9');
    });

    it('should handle emoji in path', () => {
      const url = new URL('https://example.com/hello-👋-world');
      // URL automatically encodes emoji
      expect(extractLastPathSegment(url)).toBe('hello-%F0%9F%91%8B-world');
    });

    it('should handle special punctuation', () => {
      const url = new URL('https://example.com/path!@#$%^&*()');
      expect(extractLastPathSegment(url)).toBe('path!@');
    });

    it('should handle mixed special characters', () => {
      const url = new URL('https://example.com/test_page-123.html');
      expect(extractLastPathSegment(url)).toBe('test_page-123.html');
    });
  });

  describe('sanitizeShortCode - special character handling', () => {
    it('should replace all special characters with hyphens', () => {
      expect(sanitizeShortCode('test!@#$%code')).toBe('test-code');
    });

    it('should handle parentheses and brackets', () => {
      expect(sanitizeShortCode('test(123)[456]')).toBe('test-123');
    });

    it('should handle quotes and apostrophes', () => {
      expect(sanitizeShortCode("test'code\"name")).toBe('test-code');
    });

    it('should handle ampersands and pipes', () => {
      expect(sanitizeShortCode('test&code|name')).toBe('test-code');
    });

    it('should handle plus signs and equals', () => {
      expect(sanitizeShortCode('test+code=value')).toBe('test-code');
    });

    it('should handle slashes and backslashes', () => {
      expect(sanitizeShortCode('test/code\\name')).toBe('test-code');
    });

    it('should handle dots and commas', () => {
      expect(sanitizeShortCode('test.code,name')).toBe('test-code');
    });

    it('should handle unicode special characters', () => {
      expect(sanitizeShortCode('café-résumé')).toBe('caf-r-sum');
    });

    it('should handle emoji characters', () => {
      expect(sanitizeShortCode('hello-👋-world')).toBe('hello-worl');
    });

    it('should handle mixed alphanumeric and special chars', () => {
      expect(sanitizeShortCode('Test123!@#Code456$%^')).toBe('test123');
    });

    it('should handle only special characters', () => {
      expect(sanitizeShortCode('!@#$%^&*()')).toBe('');
    });

    it('should handle special chars at boundaries', () => {
      expect(sanitizeShortCode('!test-code!')).toBe('test-code');
    });
  });

  describe('generateSmartShortCode - special character scenarios', () => {
    const mockPrisma = {
      link: {
        findUnique: jest.fn(),
      },
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should sanitize URL with special characters in path', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/My_Special@Page#123', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL-encoded characters', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/hello%20world', mockPrisma);

      expect(result.shortCode).not.toContain('%');
      expect(result.isUnique).toBe(true);
    });

    it('should handle unicode characters in URL', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/café-résumé', mockPrisma);

      // Unicode chars should be replaced with hyphens
      expect(result.shortCode).toMatch(/^[a-z0-9-]+$/);
      expect(result.isUnique).toBe(true);
    });

    it('should handle path with only special characters', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/!@#$%^&*()', mockPrisma);

      // Should fall back to domain only
      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle mixed special chars and alphanumeric', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/Test123!@#Code456', mockPrisma);

      expect(result.shortCode).toMatch(/^[a-z0-9-]+$/);
      expect(result.isUnique).toBe(true);
    });
  });
});

describe('Edge Cases: Subdomain handling', () => {
  describe('extractDomain - common subdomain removal', () => {
    it('should remove www subdomain', () => {
      const url = new URL('https://www.example.com/path');
      expect(extractDomain(url)).toBe('example');
    });

    it('should remove blog subdomain', () => {
      const url = new URL('https://blog.example.com/post');
      expect(extractDomain(url)).toBe('example');
    });

    it('should remove api subdomain', () => {
      const url = new URL('https://api.example.com/v1/users');
      expect(extractDomain(url)).toBe('example');
    });

    it('should remove m subdomain (mobile)', () => {
      const url = new URL('https://m.example.com/page');
      expect(extractDomain(url)).toBe('example');
    });

    it('should remove mobile subdomain', () => {
      const url = new URL('https://mobile.example.com/app');
      expect(extractDomain(url)).toBe('example');
    });

    it('should keep non-common subdomains', () => {
      const url = new URL('https://docs.example.com/guide');
      expect(extractDomain(url)).toBe('docs');
    });

    it('should keep shop subdomain', () => {
      const url = new URL('https://shop.example.com/products');
      expect(extractDomain(url)).toBe('shop');
    });

    it('should keep app subdomain', () => {
      const url = new URL('https://app.example.com/dashboard');
      expect(extractDomain(url)).toBe('app');
    });

    it('should keep mail subdomain', () => {
      const url = new URL('https://mail.example.com/inbox');
      expect(extractDomain(url)).toBe('mail');
    });
  });

  describe('extractDomain - multiple subdomain scenarios', () => {
    it('should handle www with additional subdomain', () => {
      const url = new URL('https://www.docs.example.com/guide');
      expect(extractDomain(url)).toBe('docs');
    });

    it('should handle blog with additional subdomain', () => {
      const url = new URL('https://blog.en.example.com/post');
      expect(extractDomain(url)).toBe('en');
    });

    it('should handle api with version subdomain', () => {
      const url = new URL('https://api.v2.example.com/endpoint');
      expect(extractDomain(url)).toBe('v2');
    });

    it('should handle three-level subdomain with common prefix', () => {
      const url = new URL('https://www.app.example.com/page');
      expect(extractDomain(url)).toBe('app');
    });

    it('should handle mobile with region subdomain', () => {
      const url = new URL('https://mobile.us.example.com/page');
      expect(extractDomain(url)).toBe('us');
    });
  });

  describe('extractDomain - edge cases with subdomains', () => {
    it('should handle single-part domain (no subdomain)', () => {
      const url = new URL('http://localhost:3000/page');
      expect(extractDomain(url)).toBe('localhost');
    });

    it('should handle two-part domain without common subdomain', () => {
      const url = new URL('https://example.com/page');
      expect(extractDomain(url)).toBe('example');
    });

    it('should handle domain that IS a common subdomain name', () => {
      const url = new URL('https://www.com/page');
      expect(extractDomain(url)).toBe('www');
    });

    it('should handle blog.com as main domain', () => {
      const url = new URL('https://blog.com/post');
      expect(extractDomain(url)).toBe('blog');
    });

    it('should handle api.com as main domain', () => {
      const url = new URL('https://api.com/endpoint');
      expect(extractDomain(url)).toBe('api');
    });

    it('should not remove common subdomain from two-part domain', () => {
      const url = new URL('https://www.example');
      expect(extractDomain(url)).toBe('www');
    });
  });

  describe('generateSmartShortCode - subdomain scenarios', () => {
    const mockPrisma = {
      link: {
        findUnique: jest.fn(),
      },
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should ignore www subdomain in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://www.linkedin.com/in/john-doe', mockPrisma);

      expect(result.shortCode).toBe('linkedin');
      expect(result.shortCode).not.toContain('www');
      expect(result.isUnique).toBe(true);
    });

    it('should ignore blog subdomain in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://blog.medium.com/post-title', mockPrisma);

      expect(result.shortCode).toBe('medium');
      expect(result.shortCode).not.toContain('blog');
      expect(result.isUnique).toBe(true);
    });

    it('should ignore api subdomain in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://api.github.com/users/octocat', mockPrisma);

      expect(result.shortCode).toBe('github');
      expect(result.shortCode).not.toContain('api');
      expect(result.isUnique).toBe(true);
    });

    it('should ignore m subdomain in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://m.facebook.com/profile', mockPrisma);

      expect(result.shortCode).toBe('facebook');
      expect(result.shortCode).not.toContain('m-');
      expect(result.isUnique).toBe(true);
    });

    it('should ignore mobile subdomain in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://mobile.twitter.com/user', mockPrisma);

      expect(result.shortCode).toBe('twitter');
      expect(result.shortCode).not.toContain('mobile');
      expect(result.isUnique).toBe(true);
    });

    it('should keep non-common subdomains in short code', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://docs.example.com/guide', mockPrisma);

      expect(result.shortCode).toBe('docs-guide');
      expect(result.isUnique).toBe(true);
    });
  });
});

describe('Edge Cases: Numeric suffix generation (collision handling)', () => {
  const mockPrisma = {
    link: {
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSmartShortCode - collision scenarios', () => {
    it('should append -2 on first collision', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'example' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example-2');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(2);
    });

    it('should increment to -3 on second collision', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'example' })
        .mockResolvedValueOnce({ shortCode: 'example-2' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example-3');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(3);
    });

    it('should handle many collisions (up to -10)', async () => {
      // Mock 9 collisions, 10th is unique
      for (let i = 0; i < 9; i++) {
        mockPrisma.link.findUnique.mockResolvedValueOnce({ shortCode: `example${i > 0 ? `-${i + 1}` : ''}` });
      }
      mockPrisma.link.findUnique.mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example-10');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(10);
    });

    it('should handle extreme collisions (up to -100)', async () => {
      // Mock 99 collisions, 100th is unique
      for (let i = 0; i < 99; i++) {
        mockPrisma.link.findUnique.mockResolvedValueOnce({ shortCode: `test${i > 0 ? `-${i + 1}` : ''}` });
      }
      mockPrisma.link.findUnique.mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://test.com', mockPrisma);

      expect(result.shortCode).toBe('test-100');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(100);
    });

    it('should handle collision with already truncated code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'verylongco' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://verylongcode.com', mockPrisma);

      expect(result.shortCode).toBe('verylongco-2');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(2);
    });

    it('should handle collision with domain-path combination', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'github' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://github.com/user/repo', mockPrisma);

      expect(result.shortCode).toBe('github-2');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(2);
    });

    it('should handle collision with sanitized special characters', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'example' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://example.com/Test@123', mockPrisma);

      expect(result.shortCode).toBe('example-2');
      expect(result.isUnique).toBe(true);
    });

    it('should handle collision with subdomain-removed code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'linkedin' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://www.linkedin.com/in/john-doe', mockPrisma);

      expect(result.shortCode).toBe('linkedin-2');
      expect(result.isUnique).toBe(true);
    });

    it('should handle multiple URLs generating same base code', async () => {
      // First URL: example.com -> 'example'
      mockPrisma.link.findUnique.mockResolvedValueOnce(null);
      const result1 = await generateSmartShortCode('https://example.com', mockPrisma);
      expect(result1.shortCode).toBe('example');

      // Second URL: www.example.com -> 'example' (collision) -> 'example-2'
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'example' })
        .mockResolvedValueOnce(null);
      const result2 = await generateSmartShortCode('https://www.example.com', mockPrisma);
      expect(result2.shortCode).toBe('example-2');
    });
  });

  describe('generateSmartShortCode - suffix edge cases', () => {
    it('should handle collision where suffix makes code longer than 10 chars', async () => {
      // Base code is 10 chars, adding -2 makes it 12 chars
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'exactly10c' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://exactly10chars.com', mockPrisma);

      expect(result.shortCode).toBe('exactly10c-2');
      expect(result.shortCode.length).toBeGreaterThan(10);
      expect(result.isUnique).toBe(true);
    });

    it('should handle collision with single-char base code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'a' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://a.com', mockPrisma);

      expect(result.shortCode).toBe('a-2');
      expect(result.isUnique).toBe(true);
    });

    it('should handle collision with two-char base code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'ab' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://ab.com', mockPrisma);

      expect(result.shortCode).toBe('ab-2');
      expect(result.isUnique).toBe(true);
    });

    it('should handle collision with numeric base code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: '123' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://123.com', mockPrisma);

      expect(result.shortCode).toBe('123-2');
      expect(result.isUnique).toBe(true);
    });

    it('should handle collision with hyphenated base code', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'my-example' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://my-example.com', mockPrisma);

      expect(result.shortCode).toBe('my-example-2');
      expect(result.isUnique).toBe(true);
    });
  });
});

describe('Edge Cases: Combined scenarios', () => {
  const mockPrisma = {
    link: {
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle URL with no path, special chars in domain, and collision', async () => {
    mockPrisma.link.findUnique
      .mockResolvedValueOnce({ shortCode: 'my-example' })
      .mockResolvedValueOnce(null);

    const result = await generateSmartShortCode('https://my-example.com', mockPrisma);

    expect(result.shortCode).toBe('my-example-2');
    expect(result.isUnique).toBe(true);
  });

  it('should handle URL with common subdomain, long path, special chars, and collision', async () => {
    mockPrisma.link.findUnique
      .mockResolvedValueOnce({ shortCode: 'example' })
      .mockResolvedValueOnce(null);

    const result = await generateSmartShortCode('https://www.example.com/very-long-path-with-special@chars#123', mockPrisma);

    expect(result.shortCode).toBe('example-2');
    expect(result.isUnique).toBe(true);
  });

  it('should handle URL with mobile subdomain, no path, and multiple collisions', async () => {
    mockPrisma.link.findUnique
      .mockResolvedValueOnce({ shortCode: 'facebook' })
      .mockResolvedValueOnce({ shortCode: 'facebook-2' })
      .mockResolvedValueOnce({ shortCode: 'facebook-3' })
      .mockResolvedValueOnce(null);

    const result = await generateSmartShortCode('https://m.facebook.com', mockPrisma);

    expect(result.shortCode).toBe('facebook-4');
    expect(result.isUnique).toBe(true);
    expect(result.attemptNumber).toBe(4);
  });

  it('should handle URL with api subdomain, very long path, and collision', async () => {
    mockPrisma.link.findUnique
      .mockResolvedValueOnce({ shortCode: 'github' })
      .mockResolvedValueOnce(null);

    const longPath = '/users/username/repositories/repository-name/issues/123/comments';
    const result = await generateSmartShortCode(`https://api.github.com${longPath}`, mockPrisma);

    expect(result.shortCode).toBe('github-2');
    expect(result.isUnique).toBe(true);
  });

  it('should handle URL with blog subdomain, special chars, truncation, and collision', async () => {
    mockPrisma.link.findUnique
      .mockResolvedValueOnce({ shortCode: 'medium-my' })
      .mockResolvedValueOnce(null);

    const result = await generateSmartShortCode('https://blog.medium.com/My-Very-Long-Post-Title-With-Special@Chars#2024', mockPrisma);

    // The path segment "My-Very-Long-Post-Title-With-Special@Chars" gets sanitized and combined with domain
    // "medium-my-very-long-post-title-with-special-chars" -> truncated to "medium-my" -> collision -> "medium-my-2"
    expect(result.shortCode).toBe('medium-my-2');
    expect(result.shortCode.length).toBeLessThanOrEqual(15); // base + suffix
    expect(result.isUnique).toBe(true);
  });
});
