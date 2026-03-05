/**
 * Verification script to test Prisma Client generation
 * Run with: npx ts-node prisma/verify-client.ts
 */

import { PrismaClient } from '@prisma/client'

async function verifyPrismaClient() {
  console.log('🔍 Verifying Prisma Client...\n')

  try {
    // Check if PrismaClient is available
    console.log('✅ PrismaClient imported successfully')

    // Create instance
    const prisma = new PrismaClient()
    console.log('✅ PrismaClient instance created')

    // Check available models
    const models = Object.keys(prisma).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$')
    )
    console.log(`✅ Available models: ${models.join(', ')}`)

    // Verify expected models exist
    const expectedModels = ['user', 'account', 'session', 'verificationToken', 'link']
    const missingModels = expectedModels.filter((model) => !models.includes(model))

    if (missingModels.length === 0) {
      console.log('✅ All expected models are available')
    } else {
      console.log(`⚠️  Missing models: ${missingModels.join(', ')}`)
    }

    console.log('\n✨ Prisma Client verification complete!')
    console.log('\n📝 Note: Database connection not tested (requires running PostgreSQL)')
    console.log('   To test database connection, run: npx prisma migrate deploy')

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error verifying Prisma Client:', error)
    process.exit(1)
  }
}

verifyPrismaClient()
