# Prisma Migration Setup

## Current Status

✅ **Prisma Client Generated**: The Prisma client has been successfully generated and is available in `node_modules/@prisma/client`.

✅ **Migration Files Created**: Initial migration files have been created in `prisma/migrations/20250101000000_init/`.

⚠️ **Database Connection Required**: The migration has not been applied to the database yet because PostgreSQL is not currently running.

## What Has Been Done

1. **Generated Prisma Client** (`prisma generate`)
   - The Prisma client is now available for use in the application
   - Located in `node_modules/@prisma/client`
   - Can be imported with: `import { PrismaClient } from '@prisma/client'`

2. **Created Migration Files**
   - Migration SQL file: `prisma/migrations/20250101000000_init/migration.sql`
   - Migration lock file: `prisma/migrations/migration_lock.toml`
   - These files are ready to be applied when the database is available

3. **Environment Configuration**
   - Created `.env` file with database connection string
   - Default configuration: `postgresql://postgres:postgres@localhost:5432/compacturl_dev`

## Database Schema Overview

The migration creates the following tables:

### User Table
- Stores user authentication and profile information
- Supports both email/password and OAuth authentication
- Fields: id, email, emailVerified, name, password, image, timestamps

### Account Table
- Stores OAuth provider account information
- Links users to their OAuth accounts (Google, GitHub, etc.)
- Fields: id, userId, provider, providerAccountId, tokens

### Session Table
- Stores user session information for NextAuth
- Fields: id, sessionToken, userId, expires

### VerificationToken Table
- Stores email verification tokens
- Fields: identifier, token, expires

### Link Table
- Core table for URL shortening functionality
- Fields: id, shortCode, originalUrl, userId, timestamps, expiresAt, clickCount, createdByIp, isSaved
- Supports both authenticated and anonymous link creation

## How to Apply the Migration

### Prerequisites

1. **Install PostgreSQL**
   - Download from: https://www.postgresql.org/download/
   - Or use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres -h localhost
   
   # Create database
   CREATE DATABASE compacturl_dev;
   
   # Exit
   \q
   ```

### Apply Migration

Once PostgreSQL is running and the database is created:

```bash
# Apply all pending migrations
npx prisma migrate deploy

# Or for development (includes migration creation)
npx prisma migrate dev
```

### Verify Migration

```bash
# Open Prisma Studio to view the database
npx prisma studio

# Or check migration status
npx prisma migrate status
```

## Alternative: Using Docker Compose

Create a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: compacturl_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Then run:
```bash
docker-compose up -d
npx prisma migrate deploy
```

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check if port 5432 is available: `netstat -an | findstr 5432`

### Authentication Failed
- Verify credentials in `.env` file
- Check PostgreSQL user permissions

### Migration Already Applied
- Check migration status: `npx prisma migrate status`
- Reset database if needed: `npx prisma migrate reset` (⚠️ destroys all data)

## Next Steps

1. Start PostgreSQL database
2. Run `npx prisma migrate deploy` to apply the migration
3. Verify the schema with `npx prisma studio`
4. Start developing with the Prisma client

## Prisma Client Usage

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Example: Create a link
const link = await prisma.link.create({
  data: {
    shortCode: 'abc123',
    originalUrl: 'https://example.com',
    createdByIp: '127.0.0.1'
  }
})

// Example: Find a link by short code
const foundLink = await prisma.link.findUnique({
  where: { shortCode: 'abc123' }
})
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [NextAuth with Prisma](https://next-auth.js.org/adapters/prisma)
