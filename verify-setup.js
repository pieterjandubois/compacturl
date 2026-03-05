#!/usr/bin/env node

/**
 * CompactURL Setup Verification Script
 * 
 * This script checks if your local environment is properly configured
 * to run the CompactURL application.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command, name) {
  try {
    execSync(command, { stdio: 'ignore' });
    log(`✅ ${name} is installed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${name} is NOT installed`, 'red');
    return false;
  }
}

function checkFile(filePath, name) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${name} exists`, 'green');
    return true;
  } else {
    log(`❌ ${name} is missing`, 'red');
    return false;
  }
}

function checkEnvVariable(varName) {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const regex = new RegExp(`^${varName}=.+`, 'm');
  const match = envContent.match(regex);
  
  if (match && !match[0].includes('your-') && !match[0].includes('changeme')) {
    log(`✅ ${varName} is configured`, 'green');
    return true;
  } else {
    log(`❌ ${varName} needs to be configured`, 'yellow');
    return false;
  }
}

async function main() {
  log('\n🔍 CompactURL Setup Verification\n', 'cyan');
  log('Checking your local environment...\n', 'blue');

  let allChecks = true;

  // Check Node.js
  log('📦 Prerequisites:', 'cyan');
  allChecks = checkCommand('node --version', 'Node.js') && allChecks;
  
  // Check npm
  allChecks = checkCommand('npm --version', 'npm') && allChecks;
  
  // Check PostgreSQL
  allChecks = checkCommand('psql --version', 'PostgreSQL') && allChecks;
  
  // Check Redis (optional)
  const redisInstalled = checkCommand('redis-cli --version', 'Redis (optional)');
  if (!redisInstalled) {
    log('  ℹ️  Redis is optional but recommended for better performance', 'yellow');
  }

  log('\n📁 Project Files:', 'cyan');
  
  // Check package.json
  allChecks = checkFile('package.json', 'package.json') && allChecks;
  
  // Check node_modules
  const nodeModulesExists = checkFile('node_modules', 'node_modules');
  if (!nodeModulesExists) {
    log('  ℹ️  Run: npm install', 'yellow');
    allChecks = false;
  }
  
  // Check Prisma schema
  allChecks = checkFile('prisma/schema.prisma', 'Prisma schema') && allChecks;
  
  // Check .env file
  log('\n⚙️  Environment Configuration:', 'cyan');
  const envExists = checkFile('.env', '.env file');
  if (!envExists) {
    log('  ℹ️  Run: cp .env.example .env', 'yellow');
    allChecks = false;
  } else {
    // Check environment variables
    checkEnvVariable('DATABASE_URL');
    checkEnvVariable('NEXTAUTH_SECRET');
    checkEnvVariable('NEXTAUTH_URL');
    
    // Check Redis URL (optional)
    const redisConfigured = checkEnvVariable('REDIS_URL');
    if (!redisConfigured && redisInstalled) {
      log('  ℹ️  REDIS_URL is not configured but Redis is installed', 'yellow');
    }
  }

  // Check Prisma Client
  log('\n🗄️  Database Setup:', 'cyan');
  const prismaClientExists = checkFile('node_modules/.prisma/client', 'Prisma Client');
  if (!prismaClientExists) {
    log('  ℹ️  Run: npm run prisma:generate', 'yellow');
    allChecks = false;
  }

  // Check migrations
  const migrationsExist = checkFile('prisma/migrations', 'Prisma migrations');
  if (!migrationsExist) {
    log('  ℹ️  Run: npm run prisma:migrate', 'yellow');
    allChecks = false;
  }

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  if (allChecks) {
    log('\n✅ Setup verification PASSED!', 'green');
    log('\nYou\'re ready to run the application:', 'green');
    log('  npm run dev\n', 'cyan');
  } else {
    log('\n⚠️  Setup verification found issues', 'yellow');
    log('\nPlease address the issues above and run this script again.', 'yellow');
    log('\nFor help, see:', 'blue');
    log('  - QUICKSTART.md (quick setup)', 'cyan');
    log('  - LOCAL_SETUP.md (detailed guide)', 'cyan');
    log('  - SETUP_CHECKLIST.md (track progress)\n', 'cyan');
  }
  log('='.repeat(50) + '\n', 'blue');

  process.exit(allChecks ? 0 : 1);
}

main().catch((error) => {
  log(`\n❌ Error running verification: ${error.message}`, 'red');
  process.exit(1);
});
