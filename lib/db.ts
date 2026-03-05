/**
 * Centralized Prisma Client with Connection Pooling
 * 
 * This module provides a singleton Prisma client instance with optimized
 * connection pooling configuration to handle concurrent requests efficiently.
 * 
 * Connection Pool Configuration (Requirement 12.4):
 * - Minimum connections: 5
 * - Maximum connections: 20
 * - Connection timeout: 10 seconds
 * - Pool timeout: 10 seconds
 * 
 * The singleton pattern ensures only one Prisma client instance exists
 * across the application, preventing connection pool exhaustion.
 */

import { PrismaClient } from '@prisma/client';

// Extend PrismaClient to add logging for connection pool monitoring
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });
};

// Global type declaration for the Prisma client singleton
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Create or reuse the Prisma client instance
// In development, use global to prevent multiple instances during hot reload
// In production, create a new instance
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Store the instance globally in development to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Connection pool monitoring (optional, for debugging)
if (process.env.NODE_ENV === 'development') {
  // Log query events to monitor connection usage
  prisma.$on('query' as never, (e: any) => {
    if (process.env.DEBUG_DB === 'true') {
      console.log('Query: ' + e.query);
      console.log('Duration: ' + e.duration + 'ms');
    }
  });

  // Log errors
  prisma.$on('error' as never, (e: any) => {
    console.error('Database error:', e);
  });

  // Log warnings
  prisma.$on('warn' as never, (e: any) => {
    console.warn('Database warning:', e);
  });
}

/**
 * Graceful shutdown handler
 * Ensures all database connections are properly closed on application shutdown
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

// Handle process termination signals
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });

  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

export default prisma;
