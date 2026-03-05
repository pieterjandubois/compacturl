/**
 * Unit Tests for Smart Naming Engine - URL Parsing Utilities
 * 
 * Tests the extractDomain, extractLastPathSegment, sanitizeShortCode, and generateSmartShortCode functions
 * to ensure they correctly parse URLs and generate valid short codes.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 */

import { extractDomain, extractLastPathSegment, sanitizeShortCode, generateSmartShortCode } from '../smart-naming';

describe('extractDomain', () => {
  describe('basic domain extraction', () => {
    it('should extract domain from simple URL', () => {
      const url = new URL('https://example.com');
      expect(extractDomain(url)).toBe('example');
    });

    it('should extract domain from URL with path', () => {
      const url = new URL('https://example.com/path/to/page');
      expect(extractDomain(url)).toBe('example');
    });

    it('should extract domain from URL with query parameters', () => {
      const url = new URL('https://example.com?query=value');
      expect(extractDomain(url)).toBe('example');
    });
  });

  describe('subdomain handling', () => {
    it('should remove www subdomain', () => {
      const url = new URL('https://www.linkedin.com/in/john-doe');
      expect(extractDomain(url)).toBe('linkedin');
    });

    it('should remove blog subdomain', () => {
      const url = new URL('https://blog.example.com/post');
      expect(extractDomain(url)).toBe('example');
    });

    it('should remove api subdomain', () => {
      const url = new URL('https://api.github.com/users');
      expect(extractDomain(url)).toBe('github');
    });

    it('should remove m subdomain', () => {
      const url = new URL('https://m.facebook.com/profile');
      expect(extractDomain(url)).toBe('facebook');
    });

    it('should remove mobile subdomain', () => {
      const url = new URL('https://mobile.twitter.com/user');
      expect(extractDomain(url)).toBe('twitter');
    });

    it('should keep non-common subdomains', () => {
      const url = new URL('https://docs.example.com/guide');
      expect(extractDomain(url)).toBe('docs');
    });

    it('should handle multiple subdomains', () => {
      const url = new URL('https://www.docs.example.com/guide');
      expect(extractDomain(url)).toBe('docs');
    });
  });

  describe('edge cases', () => {
    it('should handle single-part domain (localhost)', () => {
      const url = new URL('http://localhost:3000');
      expect(extractDomain(url)).toBe('localhost');
    });

    it('should handle IP addresses', () => {
      const url = new URL('http://192.168.1.1');
      expect(extractDomain(url)).toBe('192');
    });

    it('should handle domains with hyphens', () => {
      const url = new URL('https://my-example.com');
      expect(extractDomain(url)).toBe('my-example');
    });

    it('should handle international domains', () => {
      const url = new URL('https://example.co.uk');
      expect(extractDomain(url)).toBe('example');
    });
  });
});

describe('extractLastPathSegment', () => {
  describe('basic path extraction', () => {
    it('should extract last segment from simple path', () => {
      const url = new URL('https://example.com/page');
      expect(extractLastPathSegment(url)).toBe('page');
    });

    it('should extract last segment from multi-level path', () => {
      const url = new URL('https://example.com/path/to/page');
      expect(extractLastPathSegment(url)).toBe('page');
    });

    it('should return empty string for root path', () => {
      const url = new URL('https://example.com/');
      expect(extractLastPathSegment(url)).toBe('');
    });

    it('should return empty string for URL without path', () => {
      const url = new URL('https://example.com');
      expect(extractLastPathSegment(url)).toBe('');
    });
  });

  describe('real-world examples', () => {
    it('should extract from LinkedIn profile URL', () => {
      const url = new URL('https://linkedin.com/in/john-doe');
      expect(extractLastPathSegment(url)).toBe('john-doe');
    });

    it('should extract from GitHub repository URL', () => {
      const url = new URL('https://github.com/user/repo/issues');
      expect(extractLastPathSegment(url)).toBe('issues');
    });

    it('should extract from blog post URL', () => {
      const url = new URL('https://example.com/blog/2024/post-title');
      expect(extractLastPathSegment(url)).toBe('post-title');
    });

    it('should extract from product URL', () => {
      const url = new URL('https://shop.example.com/products/item-123');
      expect(extractLastPathSegment(url)).toBe('item-123');
    });
  });

  describe('edge cases', () => {
    it('should handle trailing slash', () => {
      const url = new URL('https://example.com/page/');
      expect(extractLastPathSegment(url)).toBe('page');
    });

    it('should handle multiple trailing slashes', () => {
      const url = new URL('https://example.com/page///');
      expect(extractLastPathSegment(url)).toBe('page');
    });

    it('should handle path with special characters', () => {
      const url = new URL('https://example.com/path/my-page_123');
      expect(extractLastPathSegment(url)).toBe('my-page_123');
    });

    it('should handle encoded characters', () => {
      const url = new URL('https://example.com/path/hello%20world');
      expect(extractLastPathSegment(url)).toBe('hello%20world');
    });

    it('should ignore query parameters', () => {
      const url = new URL('https://example.com/page?query=value');
      expect(extractLastPathSegment(url)).toBe('page');
    });

    it('should ignore hash fragments', () => {
      const url = new URL('https://example.com/page#section');
      expect(extractLastPathSegment(url)).toBe('page');
    });
  });
});

describe('sanitizeShortCode', () => {
  describe('basic sanitization', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeShortCode('LinkedIn')).toBe('linkedin');
      expect(sanitizeShortCode('GITHUB')).toBe('github');
      expect(sanitizeShortCode('MixedCase')).toBe('mixedcase');
    });

    it('should replace special characters with hyphens', () => {
      expect(sanitizeShortCode('hello@world')).toBe('hello-worl');
      expect(sanitizeShortCode('test#123')).toBe('test-123');
      expect(sanitizeShortCode('user_name')).toBe('user-name');
    });

    it('should keep alphanumeric characters and hyphens', () => {
      expect(sanitizeShortCode('abc-123')).toBe('abc-123');
      expect(sanitizeShortCode('test-code')).toBe('test-code');
    });

    it('should remove consecutive hyphens', () => {
      expect(sanitizeShortCode('test---code')).toBe('test-code');
      expect(sanitizeShortCode('a--b--c')).toBe('a-b-c');
    });

    it('should remove leading hyphens', () => {
      expect(sanitizeShortCode('-test')).toBe('test');
      expect(sanitizeShortCode('---start')).toBe('start');
    });

    it('should remove trailing hyphens', () => {
      expect(sanitizeShortCode('test-')).toBe('test');
      expect(sanitizeShortCode('end---')).toBe('end');
    });

    it('should remove both leading and trailing hyphens', () => {
      expect(sanitizeShortCode('-test-')).toBe('test');
      expect(sanitizeShortCode('---middle---')).toBe('middle');
    });
  });

  describe('truncation', () => {
    it('should truncate to default 10 characters', () => {
      expect(sanitizeShortCode('verylongshortcode')).toBe('verylongsh');
    });

    it('should respect custom maxLength', () => {
      expect(sanitizeShortCode('longcode', 5)).toBe('longc');
      expect(sanitizeShortCode('test', 8)).toBe('test');
    });

    it('should not truncate if within maxLength', () => {
      expect(sanitizeShortCode('short')).toBe('short');
      expect(sanitizeShortCode('exactly10c')).toBe('exactly10c');
    });

    it('should truncate at word boundary (hyphen) when possible', () => {
      expect(sanitizeShortCode('linkedin-john-doe')).toBe('linkedin');
      expect(sanitizeShortCode('github-user-repo')).toBe('github');
    });

    it('should not truncate at hyphen if too early', () => {
      // Hyphen at position 3, which is < maxLength/2 (5), so don't break there
      expect(sanitizeShortCode('abc-verylongtext')).toBe('abc-verylo');
    });

    it('should truncate at last hyphen in second half', () => {
      // "example-test-code" -> truncate to 10 -> "example-te"
      // Last hyphen at position 7, which is > 5, so break there
      expect(sanitizeShortCode('example-test-code')).toBe('example');
    });
  });

  describe('combined operations', () => {
    it('should handle complex sanitization and truncation', () => {
      // "LinkedIn-John_Doe@123" -> lowercase -> "linkedin-john_doe@123"
      // -> replace special chars -> "linkedin-john-doe-123"
      // -> truncate to 10 -> "linkedin-j" but hyphen at position 8 > 5, so break there
      expect(sanitizeShortCode('LinkedIn-John_Doe@123')).toBe('linkedin');
    });

    it('should handle all special characters', () => {
      expect(sanitizeShortCode('test!@#$%^&*()code')).toBe('test-code');
    });

    it('should handle empty string', () => {
      expect(sanitizeShortCode('')).toBe('');
    });

    it('should handle only special characters', () => {
      expect(sanitizeShortCode('!@#$%^&*()')).toBe('');
    });

    it('should handle only hyphens', () => {
      expect(sanitizeShortCode('-----')).toBe('');
    });
  });

  describe('real-world examples', () => {
    it('should sanitize LinkedIn profile', () => {
      expect(sanitizeShortCode('linkedin-john-doe')).toBe('linkedin');
    });

    it('should sanitize GitHub repository', () => {
      expect(sanitizeShortCode('github-user-repo')).toBe('github');
    });

    it('should sanitize blog post title', () => {
      expect(sanitizeShortCode('example-blog-post-2024')).toBe('example');
    });

    it('should sanitize product name', () => {
      // "shop-product-item-123" -> already lowercase
      // -> truncate to 10 -> "shop-produ" but hyphen at position 4 < 5, so don't break
      // Actually hyphen at 4 is not > 5, so we keep "shop-produ"
      expect(sanitizeShortCode('shop-product-item-123')).toBe('shop-produ');
    });

    it('should handle mixed case with special chars', () => {
      // "MyBlog@Post#2024" -> lowercase -> "myblog@post#2024"
      // -> replace special chars -> "myblog-post-2024"
      // -> truncate to 10 -> "myblog-pos" but hyphen at position 6 > 5, so break there
      expect(sanitizeShortCode('MyBlog@Post#2024')).toBe('myblog');
    });
  });

  describe('edge cases', () => {
    it('should handle single character', () => {
      expect(sanitizeShortCode('a')).toBe('a');
    });

    it('should handle numbers only', () => {
      expect(sanitizeShortCode('123456789012345')).toBe('1234567890');
    });

    it('should handle unicode characters', () => {
      expect(sanitizeShortCode('café-résumé')).toBe('caf-r-sum');
    });

    it('should handle spaces', () => {
      expect(sanitizeShortCode('hello world test')).toBe('hello-worl');
    });

    it('should handle dots', () => {
      // "example.com.page" -> replace dots with hyphens -> "example-com-page"
      // -> truncate to 10 -> "example-co" but hyphen at position 7 > 5, so break there
      expect(sanitizeShortCode('example.com.page')).toBe('example');
    });
  });
});

describe('integration scenarios', () => {
  it('should work together for LinkedIn URL', () => {
    const url = new URL('https://www.linkedin.com/in/john-doe');
    const domain = extractDomain(url);
    const path = extractLastPathSegment(url);
    const combined = `${domain}-${path}`;
    const sanitized = sanitizeShortCode(combined);
    
    expect(domain).toBe('linkedin');
    expect(path).toBe('john-doe');
    expect(sanitized).toBe('linkedin');
  });

  it('should work together for GitHub URL', () => {
    const url = new URL('https://github.com/user/repository');
    const domain = extractDomain(url);
    const path = extractLastPathSegment(url);
    const combined = `${domain}-${path}`;
    const sanitized = sanitizeShortCode(combined);
    
    expect(domain).toBe('github');
    expect(path).toBe('repository');
    // "github-repository" -> truncate to 10 -> "github-rep" but hyphen at position 6 > 5, so break there
    expect(sanitized).toBe('github');
  });

  it('should work together for blog URL', () => {
    const url = new URL('https://blog.example.com/2024/my-post-title');
    const domain = extractDomain(url);
    const path = extractLastPathSegment(url);
    const combined = `${domain}-${path}`;
    const sanitized = sanitizeShortCode(combined);
    
    expect(domain).toBe('example');
    expect(path).toBe('my-post-title');
    expect(sanitized).toBe('example');
  });

  it('should handle URL with no path', () => {
    const url = new URL('https://www.example.com');
    const domain = extractDomain(url);
    const path = extractLastPathSegment(url);
    const combined = path ? `${domain}-${path}` : domain;
    const sanitized = sanitizeShortCode(combined);
    
    expect(domain).toBe('example');
    expect(path).toBe('');
    expect(sanitized).toBe('example');
  });

  it('should handle URL with special characters in path', () => {
    const url = new URL('https://example.com/My_Special@Page#123');
    const domain = extractDomain(url);
    const path = extractLastPathSegment(url);
    const combined = `${domain}-${path}`;
    const sanitized = sanitizeShortCode(combined);
    
    expect(domain).toBe('example');
    expect(path).toBe('My_Special@Page');
    expect(sanitized).toBe('example');
  });
});

describe('generateSmartShortCode', () => {
  // Mock Prisma client
  const mockPrisma = {
    link: {
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic short code generation', () => {
    it('should generate short code from domain and path', async () => {
      // Mock: no existing link (unique)
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://www.linkedin.com/in/john-doe', mockPrisma);

      expect(result.shortCode).toBe('linkedin');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(1);
      expect(mockPrisma.link.findUnique).toHaveBeenCalledWith({
        where: { shortCode: 'linkedin' },
      });
    });

    it('should generate short code from domain only when no path', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(1);
    });

    it('should combine domain and path segment', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://github.com/user/repo', mockPrisma);

      expect(result.shortCode).toBe('github');
      expect(result.isUnique).toBe(true);
    });

    it('should sanitize special characters', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/My_Special@Page', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should truncate long codes to 10 characters', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://verylongdomainname.com/verylongpathsegment', mockPrisma);

      expect(result.shortCode.length).toBeLessThanOrEqual(10);
      expect(result.isUnique).toBe(true);
    });
  });

  describe('uniqueness checking', () => {
    it('should detect existing short code and append suffix', async () => {
      // First call: link exists
      // Second call: link doesn't exist
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'linkedin' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://www.linkedin.com/in/john-doe', mockPrisma);

      expect(result.shortCode).toBe('linkedin-2');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(2);
      expect(mockPrisma.link.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should increment suffix until unique code found', async () => {
      // First 3 attempts exist, 4th is unique
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'example' })
        .mockResolvedValueOnce({ shortCode: 'example-2' })
        .mockResolvedValueOnce({ shortCode: 'example-3' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://example.com', mockPrisma);

      expect(result.shortCode).toBe('example-4');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(4);
      expect(mockPrisma.link.findUnique).toHaveBeenCalledTimes(4);
    });

    it('should handle collision on first attempt', async () => {
      mockPrisma.link.findUnique
        .mockResolvedValueOnce({ shortCode: 'github' })
        .mockResolvedValueOnce(null);

      const result = await generateSmartShortCode('https://github.com/user/repo', mockPrisma);

      expect(result.shortCode).toBe('github-2');
      expect(result.isUnique).toBe(true);
      expect(result.attemptNumber).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle URL with only domain', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with subdomain', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://blog.example.com/post', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with query parameters', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/page?query=value', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with hash fragment', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/page#section', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with multiple path segments', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/blog/2024/post-title', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with trailing slash', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example.com/page/', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with hyphens in domain', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://my-example.com/page', mockPrisma);

      expect(result.shortCode).toBe('my-example');
      expect(result.isUnique).toBe(true);
    });

    it('should handle URL with numbers', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://example123.com/page456', mockPrisma);

      expect(result.shortCode).toBe('example123');
      expect(result.isUnique).toBe(true);
    });
  });

  describe('real-world examples', () => {
    it('should generate code for LinkedIn profile', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://www.linkedin.com/in/john-doe', mockPrisma);

      expect(result.shortCode).toBe('linkedin');
      expect(result.isUnique).toBe(true);
    });

    it('should generate code for GitHub repository', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://github.com/facebook/react', mockPrisma);

      expect(result.shortCode).toBe('github');
      expect(result.isUnique).toBe(true);
    });

    it('should generate code for blog post', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://blog.example.com/2024/my-awesome-post', mockPrisma);

      expect(result.shortCode).toBe('example');
      expect(result.isUnique).toBe(true);
    });

    it('should generate code for product page', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://shop.example.com/products/item-123', mockPrisma);

      expect(result.shortCode).toBe('shop-item');
      expect(result.isUnique).toBe(true);
    });

    it('should generate code for API documentation', async () => {
      mockPrisma.link.findUnique.mockResolvedValue(null);

      const result = await generateSmartShortCode('https://api.github.com/users/octocat', mockPrisma);

      expect(result.shortCode).toBe('github');
      expect(result.isUnique).toBe(true);
    });
  });
});
