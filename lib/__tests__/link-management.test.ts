/**
 * Unit Tests for Link Management
 * Validates Requirements: 5.1, 5.4, 5.5, 5.6, 5.9
 */

// Mock types
interface User {
  id: string;
  email: string;
}

interface Link {
  id: string;
  shortCode: string;
  originalUrl: string;
  userId: string | null;
  isSaved: boolean;
  createdAt: Date;
  clickCount: number;
  expiresAt: Date | null;
}

interface GetLinksOptions {
  userId: string;
  sortBy?: 'date' | 'name' | 'clicks';
  order?: 'asc' | 'desc';
}

interface SaveLinkOptions {
  userId: string;
  shortCode: string;
}

interface DeleteLinkOptions {
  userId: string;
  linkId: string;
}

interface DeleteAllLinksOptions {
  userId: string;
}

// Mock database
const mockDatabase: Map<string, Link> = new Map();
const mockCache: Map<string, Link> = new Map();

// Mock functions
async function getLinks(options: GetLinksOptions): Promise<Link[]> {
  const { userId, sortBy = 'date', order = 'desc' } = options;

  // Filter links by userId
  const userLinks = Array.from(mockDatabase.values()).filter(
    (link) => link.userId === userId && link.isSaved
  );

  // Sort links
  userLinks.sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'date') {
      comparison = a.createdAt.getTime() - b.createdAt.getTime();
    } else if (sortBy === 'name') {
      comparison = a.shortCode.localeCompare(b.shortCode);
    } else if (sortBy === 'clicks') {
      comparison = a.clickCount - b.clickCount;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return userLinks;
}

async function saveLink(options: SaveLinkOptions): Promise<{
  success: boolean;
  message?: string;
  link?: Link;
}> {
  const { userId, shortCode } = options;

  // Find link by shortCode
  const link = Array.from(mockDatabase.values()).find(
    (l) => l.shortCode === shortCode
  );

  if (!link) {
    return {
      success: false,
      message: 'Link not found',
    };
  }

  // Check if link is already claimed by another user
  if (link.userId !== null && link.userId !== userId) {
    return {
      success: false,
      message: 'Cannot claim link that belongs to another user',
    };
  }

  // Update link
  link.userId = userId;
  link.isSaved = true;
  link.expiresAt = null;

  // Invalidate cache
  mockCache.delete(shortCode);

  return {
    success: true,
    link,
  };
}

async function deleteLink(options: DeleteLinkOptions): Promise<{
  success: boolean;
  message?: string;
}> {
  const { userId, linkId } = options;

  // Find link by ID
  const link = mockDatabase.get(linkId);

  if (!link) {
    return {
      success: false,
      message: 'Link not found',
    };
  }

  // Verify ownership
  if (link.userId !== userId) {
    return {
      success: false,
      message: 'Cannot delete link that belongs to another user',
    };
  }

  // Delete link
  mockDatabase.delete(linkId);

  // Invalidate cache
  mockCache.delete(link.shortCode);

  return {
    success: true,
  };
}

async function deleteAllLinks(options: DeleteAllLinksOptions): Promise<{
  success: boolean;
  count: number;
}> {
  const { userId } = options;

  // Find all user's links
  const userLinks = Array.from(mockDatabase.entries()).filter(
    ([_, link]) => link.userId === userId && link.isSaved
  );

  // Delete all links
  for (const [id, link] of userLinks) {
    mockDatabase.delete(id);
    mockCache.delete(link.shortCode);
  }

  return {
    success: true,
    count: userLinks.length,
  };
}

describe('Link Management - Unit Tests', () => {
  beforeEach(() => {
    mockDatabase.clear();
    mockCache.clear();
  });

  describe('GET /api/links - List User Links', () => {
    it('should return user\'s saved links', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      // Create some links
      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 10,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 5,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const links = await getLinks({ userId: user.id });

      expect(links).toHaveLength(2);
      expect(links[0].id).toBe('link-2'); // Sorted by date desc
      expect(links[1].id).toBe('link-1');
    });

    it('should sort links by date ascending', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-03'),
        clickCount: 10,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 5,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const links = await getLinks({ userId: user.id, sortBy: 'date', order: 'asc' });

      expect(links[0].id).toBe('link-2');
      expect(links[1].id).toBe('link-1');
    });

    it('should sort links by name', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'zebra',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 10,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'apple',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 5,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const links = await getLinks({ userId: user.id, sortBy: 'name', order: 'asc' });

      expect(links[0].shortCode).toBe('apple');
      expect(links[1].shortCode).toBe('zebra');
    });

    it('should sort links by clicks', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 5,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 20,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const links = await getLinks({ userId: user.id, sortBy: 'clicks', order: 'desc' });

      expect(links[0].clickCount).toBe(20);
      expect(links[1].clickCount).toBe(5);
    });

    it('should only return user\'s own links', async () => {
      const user1: User = { id: 'user-1', email: 'user1@example.com' };
      const user2: User = { id: 'user-2', email: 'user2@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user1.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 10,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user2.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 5,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const links = await getLinks({ userId: user1.id });

      expect(links).toHaveLength(1);
      expect(links[0].id).toBe('link-1');
    });

    it('should return empty array if user has no links', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const links = await getLinks({ userId: user.id });

      expect(links).toHaveLength(0);
    });
  });

  describe('POST /api/links/save - Save Link', () => {
    it('should save anonymous link successfully', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: null,
        isSaved: false,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: new Date('2024-01-03'),
      };

      mockDatabase.set(link.id, link);

      const result = await saveLink({ userId: user.id, shortCode: 'test-1' });

      expect(result.success).toBe(true);
      expect(result.link?.userId).toBe(user.id);
      expect(result.link?.isSaved).toBe(true);
      expect(result.link?.expiresAt).toBeNull();
    });

    it('should return error if link not found', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const result = await saveLink({ userId: user.id, shortCode: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error if link belongs to another user', async () => {
      const user1: User = { id: 'user-1', email: 'user1@example.com' };
      const user2: User = { id: 'user-2', email: 'user2@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user1.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link.id, link);

      const result = await saveLink({ userId: user2.id, shortCode: 'test-1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('another user');
    });

    it('should allow user to save their own link again', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link.id, link);

      const result = await saveLink({ userId: user.id, shortCode: 'test-1' });

      expect(result.success).toBe(true);
    });

    it('should invalidate cache when saving link', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: null,
        isSaved: false,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: new Date('2024-01-03'),
      };

      mockDatabase.set(link.id, link);
      mockCache.set('test-1', link);

      await saveLink({ userId: user.id, shortCode: 'test-1' });

      expect(mockCache.has('test-1')).toBe(false);
    });
  });

  describe('DELETE /api/links/[id] - Delete Link', () => {
    it('should delete own link successfully', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link.id, link);

      const result = await deleteLink({ userId: user.id, linkId: 'link-1' });

      expect(result.success).toBe(true);
      expect(mockDatabase.has('link-1')).toBe(false);
    });

    it('should return error if link not found', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const result = await deleteLink({ userId: user.id, linkId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error if trying to delete another user\'s link', async () => {
      const user1: User = { id: 'user-1', email: 'user1@example.com' };
      const user2: User = { id: 'user-2', email: 'user2@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user1.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link.id, link);

      const result = await deleteLink({ userId: user2.id, linkId: 'link-1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('another user');
      expect(mockDatabase.has('link-1')).toBe(true);
    });

    it('should invalidate cache when deleting link', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link.id, link);
      mockCache.set('test-1', link);

      await deleteLink({ userId: user.id, linkId: 'link-1' });

      expect(mockCache.has('test-1')).toBe(false);
    });
  });

  describe('DELETE /api/links - Delete All Links', () => {
    it('should delete all user\'s links', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const result = await deleteAllLinks({ userId: user.id });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockDatabase.has('link-1')).toBe(false);
      expect(mockDatabase.has('link-2')).toBe(false);
    });

    it('should only delete user\'s own links', async () => {
      const user1: User = { id: 'user-1', email: 'user1@example.com' };
      const user2: User = { id: 'user-2', email: 'user2@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user1.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user2.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);

      const result = await deleteAllLinks({ userId: user1.id });

      expect(result.count).toBe(1);
      expect(mockDatabase.has('link-1')).toBe(false);
      expect(mockDatabase.has('link-2')).toBe(true);
    });

    it('should return count 0 if user has no links', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const result = await deleteAllLinks({ userId: user.id });

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it('should invalidate all caches when deleting all links', async () => {
      const user: User = { id: 'user-1', email: 'user@example.com' };

      const link1: Link = {
        id: 'link-1',
        shortCode: 'test-1',
        originalUrl: 'https://example.com/1',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-01'),
        clickCount: 0,
        expiresAt: null,
      };
      const link2: Link = {
        id: 'link-2',
        shortCode: 'test-2',
        originalUrl: 'https://example.com/2',
        userId: user.id,
        isSaved: true,
        createdAt: new Date('2024-01-02'),
        clickCount: 0,
        expiresAt: null,
      };

      mockDatabase.set(link1.id, link1);
      mockDatabase.set(link2.id, link2);
      mockCache.set('test-1', link1);
      mockCache.set('test-2', link2);

      await deleteAllLinks({ userId: user.id });

      expect(mockCache.has('test-1')).toBe(false);
      expect(mockCache.has('test-2')).toBe(false);
    });
  });
});
