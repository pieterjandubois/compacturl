/**
 * Database Index Verification Tests
 * 
 * Validates that all required indexes are present in the Prisma schema
 * for optimal query performance (Requirement 12.5)
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Database Index Verification - Requirement 12.5', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  describe('Link Table Indexes', () => {
    it('should have unique index on shortCode', () => {
      // Check for @unique directive on shortCode field
      const uniquePattern = /shortCode\s+String\s+@unique/;
      expect(schemaContent).toMatch(uniquePattern);

      // Check for explicit index definition
      const indexPattern = /@@index\(\[shortCode\]\)/;
      expect(schemaContent).toMatch(indexPattern);
    });

    it('should have index on userId', () => {
      const pattern = /@@index\(\[userId\]\)/;
      expect(schemaContent).toMatch(pattern);
    });

    it('should have index on expiresAt', () => {
      const pattern = /@@index\(\[expiresAt\]\)/;
      expect(schemaContent).toMatch(pattern);
    });

    it('should have index on createdByIp', () => {
      const pattern = /@@index\(\[createdByIp\]\)/;
      expect(schemaContent).toMatch(pattern);
    });

    it('should have index on createdAt', () => {
      const pattern = /@@index\(\[createdAt\]\)/;
      expect(schemaContent).toMatch(pattern);
    });
  });

  describe('Index Documentation', () => {
    it('should have all 5 required indexes on Link table', () => {
      // Extract Link model from schema
      const linkModelMatch = schemaContent.match(/model Link \{[\s\S]*?\n\}/);
      expect(linkModelMatch).toBeTruthy();

      const linkModel = linkModelMatch![0];

      // Count @@index directives in Link model
      const indexMatches = linkModel.match(/@@index\(/g);
      expect(indexMatches).toBeTruthy();
      expect(indexMatches!.length).toBe(5);
    });

    it('should have unique constraint on shortCode', () => {
      const linkModelMatch = schemaContent.match(/model Link \{[\s\S]*?\n\}/);
      expect(linkModelMatch).toBeTruthy();

      const linkModel = linkModelMatch![0];
      expect(linkModel).toMatch(/shortCode\s+String\s+@unique/);
    });
  });

  describe('Migration Verification', () => {
    it('should have migration file with index creation statements', () => {
      const migrationPath = path.join(
        process.cwd(),
        'prisma',
        'migrations',
        '20250101000000_init',
        'migration.sql'
      );

      const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

      // Verify all indexes are created in migration
      expect(migrationContent).toMatch(/CREATE UNIQUE INDEX "Link_shortCode_key"/);
      expect(migrationContent).toMatch(/CREATE INDEX "Link_shortCode_idx"/);
      expect(migrationContent).toMatch(/CREATE INDEX "Link_userId_idx"/);
      expect(migrationContent).toMatch(/CREATE INDEX "Link_expiresAt_idx"/);
      expect(migrationContent).toMatch(/CREATE INDEX "Link_createdByIp_idx"/);
      expect(migrationContent).toMatch(/CREATE INDEX "Link_createdAt_idx"/);
    });
  });

  describe('Index Purpose Documentation', () => {
    it('should have documentation file for database indexes', () => {
      const docPath = path.join(process.cwd(), 'lib', 'DATABASE_INDEXES.md');
      expect(fs.existsSync(docPath)).toBe(true);

      const docContent = fs.readFileSync(docPath, 'utf-8');

      // Verify documentation covers all indexes
      expect(docContent).toMatch(/shortCode.*Unique Index/i);
      expect(docContent).toMatch(/userId.*Regular Index/i);
      expect(docContent).toMatch(/expiresAt.*Regular Index/i);
      expect(docContent).toMatch(/createdByIp.*Regular Index/i);
      expect(docContent).toMatch(/createdAt.*Regular Index/i);

      // Verify documentation includes performance considerations
      expect(docContent).toMatch(/Performance Impact/i);
      expect(docContent).toMatch(/Query Patterns/i);
    });
  });

  describe('Index Coverage Analysis', () => {
    it('should cover all critical query patterns', () => {
      const docPath = path.join(process.cwd(), 'lib', 'DATABASE_INDEXES.md');
      const docContent = fs.readFileSync(docPath, 'utf-8');

      // Verify documentation covers critical use cases
      expect(docContent).toMatch(/URL redirection/i);
      expect(docContent).toMatch(/rate limiting/i);
      expect(docContent).toMatch(/cleanup.*expired/i);
      expect(docContent).toMatch(/dashboard/i);
      expect(docContent).toMatch(/analytics/i);
    });

    it('should document index maintenance procedures', () => {
      const docPath = path.join(process.cwd(), 'lib', 'DATABASE_INDEXES.md');
      const docContent = fs.readFileSync(docPath, 'utf-8');

      expect(docContent).toMatch(/Index Maintenance/i);
      expect(docContent).toMatch(/REINDEX/i);
      expect(docContent).toMatch(/pg_stat_user_indexes/i);
    });
  });
});
