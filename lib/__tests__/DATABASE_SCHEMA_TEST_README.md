# Database Schema Property-Based Tests

## Overview

This test suite validates **Property 14: Data Persistence and Integrity** for the CompactURL application using property-based testing with fast-check.

## Test Coverage

### Requirements Validated
- **14.1**: PostgreSQL with ACID transaction support
- **14.2**: Foreign key constraints between users and links tables
- **14.3**: UUID for link IDs to prevent enumeration attacks
- **14.4**: Unique constraints on Short_Code column

### Test Categories

#### 1. Foreign Key Constraints (Requirement 14.2)
- ✅ Enforces foreign key constraint between Link and User
- ✅ Sets userId to null when user is deleted (onDelete: SetNull)
- ✅ Cascade deletes sessions when user is deleted
- ✅ Cascade deletes accounts when user is deleted
- ✅ Prevents creating link with non-existent userId

#### 2. UUID Generation (Requirement 14.3)
- ✅ Generates UUID for link IDs to prevent enumeration
- ✅ Generates UUID for user IDs
- ✅ Verifies UUIDs are unique and non-sequential

#### 3. Unique Constraints (Requirement 14.4)
- ✅ Enforces unique constraint on shortCode column
- ✅ Allows different shortCodes for different links
- ✅ Enforces unique constraint on user email
- ✅ Enforces unique constraint on session token
- ✅ Enforces unique constraint on provider + providerAccountId

#### 4. Automatic Timestamp Management (Requirements 14.1 & 14.4)
- ✅ Automatically sets createdAt and updatedAt on link creation
- ✅ Automatically updates updatedAt on link modification
- ✅ Automatically sets createdAt and updatedAt on user creation
- ✅ Maintains createdAt <= updatedAt invariant

#### 5. Additional Schema Integrity
- ✅ Enforces default values correctly
- ✅ Handles nullable fields correctly
- ✅ Maintains referential integrity across multiple operations

## Property-Based Testing Approach

### Test Configuration
- **Framework**: Jest with fast-check
- **Iterations**: 100 runs per property (50 for complex operations)
- **Environment**: Node.js (specified with `@jest-environment node`)

### Generators Used
- `emailArbitrary`: Generates valid email addresses
- `urlArbitrary`: Generates valid HTTP/HTTPS URLs
- `shortCodeArbitrary`: Generates valid short codes (alphanumeric + hyphens)
- `ipAddressArbitrary`: Generates valid IPv4 addresses

### Test Strategy
Each test uses property-based testing to:
1. Generate random valid inputs
2. Perform database operations
3. Verify constraints and invariants hold
4. Clean up test data

## Running the Tests

### Prerequisites
1. **PostgreSQL Database**: A running PostgreSQL instance
2. **Database URL**: Set in `.env` file
3. **Prisma Client**: Generated and up-to-date

### Setup Steps

```bash
# 1. Ensure PostgreSQL is running
# (Install and start PostgreSQL if not already running)

# 2. Create test database
createdb compacturl_test

# 3. Set up environment variables
cp .env.example .env
# Edit .env and set DATABASE_URL to your test database

# 4. Run migrations
npx prisma migrate dev

# 5. Generate Prisma Client
npx prisma generate

# 6. Run the tests
npm test -- lib/__tests__/database-schema.test.ts
```

### Using a Test Database

For testing, it's recommended to use a separate test database:

```bash
# .env.test
DATABASE_URL="postgresql://user:password@localhost:5432/compacturl_test"
```

### CI/CD Integration

For continuous integration, consider:
- Using Docker to spin up a PostgreSQL container
- Using in-memory SQLite for faster tests (requires schema adjustments)
- Using a dedicated test database that's reset between runs

## Test Execution Flow

1. **beforeAll**: Connect to database
2. **beforeEach**: Clean all tables (in reverse dependency order)
3. **Test Execution**: Run property-based tests with 100+ iterations
4. **afterAll**: Disconnect from database

## Expected Behavior

### Successful Test Run
When all tests pass, you should see:
```
PASS  lib/__tests__/database-schema.test.ts
  Database Schema Constraints - Property 14: Data Persistence and Integrity
    Requirement 14.2: Foreign Key Constraints
      ✓ should enforce foreign key constraint between Link and User
      ✓ should set userId to null when user is deleted (onDelete: SetNull)
      ✓ should cascade delete sessions when user is deleted
      ✓ should cascade delete accounts when user is deleted
      ✓ should prevent creating link with non-existent userId
    Requirement 14.3: UUID for Link IDs
      ✓ should generate UUID for link IDs to prevent enumeration
      ✓ should generate UUID for user IDs
    Requirement 14.4: Unique Constraints on Short_Code
      ✓ should enforce unique constraint on shortCode column
      ✓ should allow different shortCodes for different links
      ✓ should enforce unique constraint on user email
      ✓ should enforce unique constraint on session token
      ✓ should enforce unique constraint on provider + providerAccountId
    Requirement 14.1 & 14.4: Automatic Timestamp Management
      ✓ should automatically set createdAt and updatedAt on link creation
      ✓ should automatically update updatedAt on link modification
      ✓ should automatically set createdAt and updatedAt on user creation
      ✓ should maintain createdAt <= updatedAt invariant
    Additional Schema Integrity Tests
      ✓ should enforce default values correctly
      ✓ should handle nullable fields correctly
      ✓ should maintain referential integrity across multiple operations

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
```

### Common Issues

#### 1. Database Connection Error
```
PrismaClientInitializationError: Can't reach database server at `localhost:5432`
```
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correctly set.

#### 2. Browser Environment Error
```
PrismaClient is unable to run in this browser environment
```
**Solution**: The test file includes `@jest-environment node` directive at the top.

#### 3. Unique Constraint Violations
If tests fail due to existing data, ensure `beforeEach` cleanup is working correctly.

## Test-First Development

These tests were written **before** the database implementation as part of the test-first development workflow:

1. ✅ **Write Tests First**: Property-based tests written to validate all schema constraints
2. ⏳ **Run Tests**: Tests will fail initially (no database connection in CI)
3. ⏳ **Implement Schema**: Prisma schema already created in Task 2.1
4. ⏳ **Run Migrations**: Apply schema to database
5. ⏳ **Verify Tests Pass**: All 19 tests should pass with 100+ iterations each

## Maintenance

### Adding New Tests
When adding new database models or constraints:
1. Add appropriate generators for new data types
2. Write property-based tests for new constraints
3. Update cleanup logic in `beforeEach` to include new tables
4. Maintain test isolation (each test should be independent)

### Updating Generators
If schema changes require different data formats:
1. Update the arbitrary generators at the top of the file
2. Ensure generated data matches new validation rules
3. Run tests to verify generators produce valid data

## Performance Considerations

- Each test runs 50-100 iterations with random data
- Full test suite may take 30-60 seconds depending on database performance
- Consider reducing iterations for faster feedback during development
- Use `numRuns: 10` for quick smoke tests, `numRuns: 100` for thorough validation

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Setup PostgreSQL
  uses: ikalnytskyi/action-setup-postgres@v4
  
- name: Run Database Tests
  run: |
    npx prisma migrate deploy
    npm test -- lib/__tests__/database-schema.test.ts
```

### Docker Compose Example
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: compacturl_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"
```

## Conclusion

This comprehensive test suite ensures that all database schema constraints are properly enforced, providing confidence that data integrity is maintained throughout the application lifecycle. The property-based testing approach validates constraints across a wide range of inputs, catching edge cases that traditional example-based tests might miss.
