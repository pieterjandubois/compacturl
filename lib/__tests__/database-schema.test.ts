/**
 * @jest-environment node
 * 
 * Property-Based Tests for Database Schema Constraints
 * 
 * Feature: compact-url
 * Property 14: Data Persistence and Integrity
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 * 
 * Tests verify:
 * - Foreign key constraints are enforced
 * - Unique constraints prevent duplicates
 * - Timestamps are automatically managed
 * - UUID generation for link IDs
 */

import { PrismaClient } from '@prisma/client';
import * as fc from 'fast-check';

// Create a test Prisma client
const prisma = new PrismaClient();

// Helper to generate valid email addresses
const emailArbitrary = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{3,10}$/),
    fc.constantFrom('gmail.com', 'yahoo.com', 'test.com', 'example.com')
  )
  .map(([local, domain]) => `${local}@${domain}`);

// Helper to generate valid URLs
const urlArbitrary = fc
  .tuple(
    fc.constantFrom('http', 'https'),
    fc.stringMatching(/^[a-z0-9-]{3,15}$/),
    fc.constantFrom('com', 'org', 'net'),
    fc.option(fc.stringMatching(/^[a-z0-9-]{3,20}$/), { nil: undefined })
  )
  .map(([protocol, domain, tld, path]) => 
    `${protocol}://${domain}.${tld}${path ? `/${path}` : ''}`
  );

// Helper to generate valid short codes
const shortCodeArbitrary = fc.stringMatching(/^[a-z0-9-]{3,15}$/);

// Helper to generate valid IP addresses
const ipAddressArbitrary = fc
  .tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

describe('Database Schema Constraints - Property 14: Data Persistence and Integrity', () => {
  let isDatabaseAvailable = false;

  // Clean up database before and after tests
  beforeAll(async () => {
    try {
      await prisma.$connect();
      // Test if database is actually reachable
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;
    } catch (error) {
      console.log('Database not available - skipping database schema tests');
      isDatabaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDatabaseAvailable) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    if (!isDatabaseAvailable) {
      return;
    }
    // Clean up all tables in reverse order of dependencies
    await prisma.link.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Requirement 14.2: Foreign Key Constraints', () => {
    it('should enforce foreign key constraint between Link and User', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          async (email, shortCode, originalUrl, ip) => {
            // Create a user
            const user = await prisma.user.create({
              data: {
                email,
                name: 'Test User',
              },
            });

            // Create a link associated with the user
            const link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                userId: user.id,
                createdByIp: ip,
              },
            });

            // Verify the link is associated with the user
            expect(link.userId).toBe(user.id);

            // Verify we can query the link through the user relationship
            const userWithLinks = await prisma.user.findUnique({
              where: { id: user.id },
              include: { links: true },
            });

            expect(userWithLinks?.links).toHaveLength(1);
            expect(userWithLinks?.links[0].id).toBe(link.id);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should set userId to null when user is deleted (onDelete: SetNull)', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          async (email, shortCode, originalUrl, ip) => {
            // Create a user
            const user = await prisma.user.create({
              data: {
                email,
                name: 'Test User',
              },
            });

            // Create a link associated with the user
            const link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                userId: user.id,
                createdByIp: ip,
              },
            });

            // Delete the user
            await prisma.user.delete({
              where: { id: user.id },
            });

            // Verify the link still exists but userId is null
            const orphanedLink = await prisma.link.findUnique({
              where: { id: link.id },
            });

            expect(orphanedLink).not.toBeNull();
            expect(orphanedLink?.userId).toBeNull();
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should cascade delete sessions when user is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.stringMatching(/^[a-z0-9]{20,40}$/),
          async (email, sessionToken) => {
            // Create a user
            const user = await prisma.user.create({
              data: {
                email,
                name: 'Test User',
              },
            });

            // Create a session for the user
            const session = await prisma.session.create({
              data: {
                sessionToken,
                userId: user.id,
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });

            // Delete the user
            await prisma.user.delete({
              where: { id: user.id },
            });

            // Verify the session is also deleted (cascade)
            const deletedSession = await prisma.session.findUnique({
              where: { id: session.id },
            });

            expect(deletedSession).toBeNull();
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should cascade delete accounts when user is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.constantFrom('google', 'github', 'facebook'),
          fc.stringMatching(/^[0-9]{10,20}$/),
          async (email, provider, providerAccountId) => {
            // Create a user
            const user = await prisma.user.create({
              data: {
                email,
                name: 'Test User',
              },
            });

            // Create an account for the user
            const account = await prisma.account.create({
              data: {
                userId: user.id,
                type: 'oauth',
                provider,
                providerAccountId,
              },
            });

            // Delete the user
            await prisma.user.delete({
              where: { id: user.id },
            });

            // Verify the account is also deleted (cascade)
            const deletedAccount = await prisma.account.findUnique({
              where: { id: account.id },
            });

            expect(deletedAccount).toBeNull();
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should prevent creating link with non-existent userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          fc.uuid(),
          async (shortCode, originalUrl, ip, nonExistentUserId) => {
            // Attempt to create a link with a non-existent userId
            await expect(
              prisma.link.create({
                data: {
                  shortCode,
                  originalUrl,
                  userId: nonExistentUserId,
                  createdByIp: ip,
                },
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Requirement 14.3: UUID for Link IDs', () => {
    it('should generate UUID for link IDs to prevent enumeration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(shortCodeArbitrary, urlArbitrary, ipAddressArbitrary),
            { minLength: 5, maxLength: 20 }
          ),
          async (linkData) => {
            // Create multiple links
            const links = await Promise.all(
              linkData.map(([shortCode, originalUrl, ip]) =>
                prisma.link.create({
                  data: {
                    shortCode: `${shortCode}-${Math.random().toString(36).substring(7)}`,
                    originalUrl,
                    createdByIp: ip,
                  },
                })
              )
            );

            // Verify all IDs are UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            links.forEach((link) => {
              expect(link.id).toMatch(uuidRegex);
            });

            // Verify all IDs are unique
            const ids = links.map((link) => link.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Verify IDs are not sequential (not enumerable)
            // UUIDs should not be predictable
            const sortedIds = [...ids].sort();
            expect(sortedIds).not.toEqual(ids); // Very unlikely to be in order
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should generate UUID for user IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(emailArbitrary, { minLength: 5, maxLength: 20 }),
          async (emails) => {
            // Create multiple users
            const users = await Promise.all(
              emails.map((email) =>
                prisma.user.create({
                  data: {
                    email,
                    name: 'Test User',
                  },
                })
              )
            );

            // Verify all IDs are UUIDs
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            users.forEach((user) => {
              expect(user.id).toMatch(uuidRegex);
            });

            // Verify all IDs are unique
            const ids = users.map((user) => user.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Requirement 14.4: Unique Constraints on Short_Code', () => {
    it('should enforce unique constraint on shortCode column', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          fc.array(urlArbitrary, { minLength: 2, maxLength: 2 }),
          ipAddressArbitrary,
          async (shortCode, [url1, url2], ip) => {
            // Create first link with shortCode
            await prisma.link.create({
              data: {
                shortCode,
                originalUrl: url1,
                createdByIp: ip,
              },
            });

            // Attempt to create second link with same shortCode
            await expect(
              prisma.link.create({
                data: {
                  shortCode, // Same shortCode
                  originalUrl: url2,
                  createdByIp: ip,
                },
              })
            ).rejects.toThrow(/Unique constraint/i);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should allow different shortCodes for different links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(shortCodeArbitrary, urlArbitrary, ipAddressArbitrary),
            { minLength: 5, maxLength: 20 }
          ),
          async (linkData) => {
            // Create multiple links with unique shortCodes
            const links = await Promise.all(
              linkData.map(([shortCode, originalUrl, ip]) =>
                prisma.link.create({
                  data: {
                    shortCode: `${shortCode}-${Math.random().toString(36).substring(7)}`,
                    originalUrl,
                    createdByIp: ip,
                  },
                })
              )
            );

            // Verify all shortCodes are unique
            const shortCodes = links.map((link) => link.shortCode);
            const uniqueShortCodes = new Set(shortCodes);
            expect(uniqueShortCodes.size).toBe(shortCodes.length);

            // Verify all links were created successfully
            expect(links).toHaveLength(linkData.length);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should enforce unique constraint on user email', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(fc.stringMatching(/^[A-Z][a-z]{3,10}$/), { minLength: 2, maxLength: 2 }),
          async (email, [name1, name2]) => {
            // Create first user with email
            await prisma.user.create({
              data: {
                email,
                name: name1,
              },
            });

            // Attempt to create second user with same email
            await expect(
              prisma.user.create({
                data: {
                  email, // Same email
                  name: name2,
                },
              })
            ).rejects.toThrow(/Unique constraint/i);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should enforce unique constraint on session token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(emailArbitrary, { minLength: 2, maxLength: 2 }),
          fc.stringMatching(/^[a-z0-9]{20,40}$/),
          async ([email1, email2], sessionToken) => {
            // Create two users
            const user1 = await prisma.user.create({
              data: { email: email1, name: 'User 1' },
            });
            const user2 = await prisma.user.create({
              data: { email: email2, name: 'User 2' },
            });

            // Create first session with token
            await prisma.session.create({
              data: {
                sessionToken,
                userId: user1.id,
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });

            // Attempt to create second session with same token
            await expect(
              prisma.session.create({
                data: {
                  sessionToken, // Same token
                  userId: user2.id,
                  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
              })
            ).rejects.toThrow(/Unique constraint/i);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should enforce unique constraint on provider + providerAccountId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(emailArbitrary, { minLength: 2, maxLength: 2 }),
          fc.constantFrom('google', 'github', 'facebook'),
          fc.stringMatching(/^[0-9]{10,20}$/),
          async ([email1, email2], provider, providerAccountId) => {
            // Create two users
            const user1 = await prisma.user.create({
              data: { email: email1, name: 'User 1' },
            });
            const user2 = await prisma.user.create({
              data: { email: email2, name: 'User 2' },
            });

            // Create first account
            await prisma.account.create({
              data: {
                userId: user1.id,
                type: 'oauth',
                provider,
                providerAccountId,
              },
            });

            // Attempt to create second account with same provider + providerAccountId
            await expect(
              prisma.account.create({
                data: {
                  userId: user2.id,
                  type: 'oauth',
                  provider, // Same provider
                  providerAccountId, // Same providerAccountId
                },
              })
            ).rejects.toThrow(/Unique constraint/i);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Requirement 14.1 & 14.4: Automatic Timestamp Management', () => {
    it('should automatically set createdAt and updatedAt on link creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          async (shortCode, originalUrl, ip) => {
            const beforeCreate = new Date();

            // Create a link
            const link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                createdByIp: ip,
              },
            });

            const afterCreate = new Date();

            // Verify createdAt is set and within expected range
            expect(link.createdAt).toBeInstanceOf(Date);
            expect(link.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
            expect(link.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);

            // Verify updatedAt is set and matches createdAt initially
            expect(link.updatedAt).toBeInstanceOf(Date);
            expect(Math.abs(link.updatedAt.getTime() - link.createdAt.getTime())).toBeLessThan(1000);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should automatically update updatedAt on link modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          fc.integer({ min: 0, max: 100 }),
          async (shortCode, originalUrl, ip, newClickCount) => {
            // Create a link
            const link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                createdByIp: ip,
              },
            });

            const originalUpdatedAt = link.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Update the link
            const updatedLink = await prisma.link.update({
              where: { id: link.id },
              data: { clickCount: newClickCount },
            });

            // Verify updatedAt changed
            expect(updatedLink.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

            // Verify createdAt didn't change
            expect(updatedLink.createdAt.getTime()).toBe(link.createdAt.getTime());
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should automatically set createdAt and updatedAt on user creation', async () => {
      await fc.assert(
        fc.asyncProperty(emailArbitrary, async (email) => {
          const beforeCreate = new Date();

          // Create a user
          const user = await prisma.user.create({
            data: {
              email,
              name: 'Test User',
            },
          });

          const afterCreate = new Date();

          // Verify createdAt is set and within expected range
          expect(user.createdAt).toBeInstanceOf(Date);
          expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
          expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);

          // Verify updatedAt is set
          expect(user.updatedAt).toBeInstanceOf(Date);
        }),
        { numRuns: 25 }
      );
    });

    it('should maintain createdAt <= updatedAt invariant', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 5 }),
          async (shortCode, originalUrl, ip, clickCounts) => {
            // Create a link
            let link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                createdByIp: ip,
              },
            });

            // Verify initial invariant
            expect(link.createdAt.getTime()).toBeLessThanOrEqual(link.updatedAt.getTime());

            // Perform multiple updates
            for (const clickCount of clickCounts) {
              await new Promise((resolve) => setTimeout(resolve, 50));

              link = await prisma.link.update({
                where: { id: link.id },
                data: { clickCount },
              });

              // Verify invariant holds after each update
              expect(link.createdAt.getTime()).toBeLessThanOrEqual(link.updatedAt.getTime());
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Additional Schema Integrity Tests', () => {
    it('should enforce default values correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          shortCodeArbitrary,
          urlArbitrary,
          ipAddressArbitrary,
          async (shortCode, originalUrl, ip) => {
            // Create a link without specifying optional fields
            const link = await prisma.link.create({
              data: {
                shortCode,
                originalUrl,
                createdByIp: ip,
              },
            });

            // Verify default values
            expect(link.clickCount).toBe(0);
            expect(link.isSaved).toBe(false);
            expect(link.userId).toBeNull();
            expect(link.expiresAt).toBeNull();
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should handle nullable fields correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.option(fc.stringMatching(/^[A-Z][a-z]{3,10}$/), { nil: undefined }),
          fc.option(fc.stringMatching(/^.{12,}$/), { nil: undefined }),
          async (email, name, password) => {
            // Create a user with optional fields
            const user = await prisma.user.create({
              data: {
                email,
                name: name || null,
                password: password || null,
              },
            });

            // Verify nullable fields are handled correctly
            if (name) {
              expect(user.name).toBe(name);
            } else {
              expect(user.name).toBeNull();
            }

            if (password) {
              expect(user.password).toBe(password);
            } else {
              expect(user.password).toBeNull();
            }

            // Verify emailVerified is null by default
            expect(user.emailVerified).toBeNull();
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should maintain referential integrity across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(
            fc.tuple(shortCodeArbitrary, urlArbitrary, ipAddressArbitrary),
            { minLength: 3, maxLength: 10 }
          ),
          async (email, linkData) => {
            // Create a user
            const user = await prisma.user.create({
              data: {
                email,
                name: 'Test User',
              },
            });

            // Create multiple links for the user
            const links = await Promise.all(
              linkData.map(([shortCode, originalUrl, ip]) =>
                prisma.link.create({
                  data: {
                    shortCode: `${shortCode}-${Math.random().toString(36).substring(7)}`,
                    originalUrl,
                    userId: user.id,
                    createdByIp: ip,
                  },
                })
              )
            );

            // Verify all links are associated with the user
            const userWithLinks = await prisma.user.findUnique({
              where: { id: user.id },
              include: { links: true },
            });

            expect(userWithLinks?.links).toHaveLength(links.length);

            // Verify each link's userId matches
            userWithLinks?.links.forEach((link) => {
              expect(link.userId).toBe(user.id);
            });

            // Delete the user
            await prisma.user.delete({
              where: { id: user.id },
            });

            // Verify all links still exist but with null userId
            const orphanedLinks = await prisma.link.findMany({
              where: {
                id: {
                  in: links.map((l) => l.id),
                },
              },
            });

            expect(orphanedLinks).toHaveLength(links.length);
            orphanedLinks.forEach((link) => {
              expect(link.userId).toBeNull();
            });
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
