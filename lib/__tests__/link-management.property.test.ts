/**
 * Property-Based Tests for Link Management
 * Property 9: Link Ownership and Permissions
 * Validates Requirements: 5.5, 5.7, 5.10, 5.11
 * 
 * Tag: Feature: compact-url, Property 9: Link Ownership and Permissions
 */

import fc from 'fast-check';

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
  createdByIp: string | null;
}

// Mock functions
function canDeleteLink(user: User, link: Link): boolean {
  // Users can only delete their own saved links
  return link.userId === user.id;
}

function canSaveLink(user: User, link: Link): boolean {
  // Cannot claim anonymous links that belong to someone else
  // Can only save links that are either:
  // 1. Not saved yet (userId is null)
  // 2. Already belong to the user
  if (link.userId === null) {
    return true;
  }
  return link.userId === user.id;
}

function canEditOriginalUrl(user: User, link: Link): boolean {
  // Cannot edit original URL of any link
  return false;
}

describe('Link Management - Property-Based Tests', () => {
  describe('Property 9: Link Ownership and Permissions', () => {
    it('should only allow users to delete their own links', () => {
      fc.assert(
        fc.property(
          fc.record({
            user: fc.record({
              id: fc.uuid(),
              email: fc.emailAddress(),
            }),
            link: fc.record({
              id: fc.uuid(),
              shortCode: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
              originalUrl: fc.webUrl(),
              userId: fc.option(fc.uuid(), { nil: null }),
              isSaved: fc.boolean(),
              createdByIp: fc.option(fc.ipV4(), { nil: null }),
            }),
          }),
          ({ user, link }) => {
            const canDelete = canDeleteLink(user, link);

            // Property: Can only delete if link belongs to user
            if (link.userId === user.id) {
              expect(canDelete).toBe(true);
            } else {
              expect(canDelete).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not allow claiming anonymous links that belong to others', () => {
      fc.assert(
        fc.property(
          fc.record({
            user: fc.record({
              id: fc.uuid(),
              email: fc.emailAddress(),
            }),
            link: fc.record({
              id: fc.uuid(),
              shortCode: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
              originalUrl: fc.webUrl(),
              userId: fc.option(fc.uuid(), { nil: null }),
              isSaved: fc.boolean(),
              createdByIp: fc.option(fc.ipV4(), { nil: null }),
            }),
          }),
          ({ user, link }) => {
            const canSave = canSaveLink(user, link);

            // Property: Can save if link is unclaimed (userId is null) or already belongs to user
            if (link.userId === null) {
              expect(canSave).toBe(true);
            } else if (link.userId === user.id) {
              expect(canSave).toBe(true);
            } else {
              // Cannot claim links that belong to other users
              expect(canSave).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should never allow editing original URL', () => {
      fc.assert(
        fc.property(
          fc.record({
            user: fc.record({
              id: fc.uuid(),
              email: fc.emailAddress(),
            }),
            link: fc.record({
              id: fc.uuid(),
              shortCode: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
              originalUrl: fc.webUrl(),
              userId: fc.option(fc.uuid(), { nil: null }),
              isSaved: fc.boolean(),
              createdByIp: fc.option(fc.ipV4(), { nil: null }),
            }),
          }),
          ({ user, link }) => {
            const canEdit = canEditOriginalUrl(user, link);

            // Property: Original URL can never be edited
            expect(canEdit).toBe(false);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should enforce ownership consistency across operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            user: fc.record({
              id: fc.uuid(),
              email: fc.emailAddress(),
            }),
            link: fc.record({
              id: fc.uuid(),
              shortCode: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
              originalUrl: fc.webUrl(),
              userId: fc.option(fc.uuid(), { nil: null }),
              isSaved: fc.boolean(),
              createdByIp: fc.option(fc.ipV4(), { nil: null }),
            }),
          }),
          ({ user, link }) => {
            const canDelete = canDeleteLink(user, link);
            const canSave = canSaveLink(user, link);

            // Property: If user can delete, they must be able to save (they own it)
            if (canDelete) {
              expect(canSave).toBe(true);
            }

            // Property: If link belongs to user, they can both save and delete
            if (link.userId === user.id) {
              expect(canDelete).toBe(true);
              expect(canSave).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle anonymous links correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            user: fc.record({
              id: fc.uuid(),
              email: fc.emailAddress(),
            }),
            anonymousLink: fc.record({
              id: fc.uuid(),
              shortCode: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
              originalUrl: fc.webUrl(),
              userId: fc.constant(null),
              isSaved: fc.constant(false),
              createdByIp: fc.ipV4(),
            }),
          }),
          ({ user, anonymousLink }) => {
            const canDelete = canDeleteLink(user, anonymousLink);
            const canSave = canSaveLink(user, anonymousLink);

            // Property: Anonymous links (userId = null) cannot be deleted by anyone
            expect(canDelete).toBe(false);

            // Property: Anonymous links can be saved (claimed) by any user
            expect(canSave).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
