#!/usr/bin/env node

/**
 * Simple Database Creation Script
 * Uses environment variables from .env file
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🗄️  PostgreSQL Database Setup (Simple)\n');
  
  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found!');
    console.log('   Please run: Copy-Item .env.example .env\n');
    process.exit(1);
  }
  
  // Read .env file
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const dbUrlMatch = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
  
  if (!dbUrlMatch) {
    console.log('❌ DATABASE_URL not found in .env file!\n');
    process.exit(1);
  }
  
  const dbUrl = dbUrlMatch[1];
  console.log('📝 Found DATABASE_URL in .env file');
  console.log(`   ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n`);
  
  // Parse the URL
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  
  if (!urlMatch) {
    console.log('❌ Invalid DATABASE_URL format!\n');
    console.log('Expected format:');
    console.log('postgresql://user:password@host:port/database\n');
    process.exit(1);
  }
  
  const [, user, password, host, port, database] = urlMatch;
  
  console.log('📊 Database Configuration:');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   User: ${user}`);
  console.log(`   Database: ${database}\n`);
  
  console.log('⚠️  To create the database, you have 3 options:\n');
  
  console.log('Option 1: Using SQL Shell (psql) from Start Menu');
  console.log('  1. Open "SQL Shell (psql)" from Windows Start menu');
  console.log('  2. Press Enter through prompts (accept defaults)');
  console.log(`  3. Enter password: ${password}`);
  console.log(`  4. Run: CREATE DATABASE ${database};`);
  console.log('  5. Verify: \\l');
  console.log('  6. Exit: \\q\n');
  
  console.log('Option 2: Using pgAdmin (GUI)');
  console.log('  1. Open pgAdmin from Start menu');
  console.log('  2. Connect to PostgreSQL server');
  console.log('  3. Right-click "Databases" → Create → Database');
  console.log(`  4. Name: ${database}`);
  console.log('  5. Click Save\n');
  
  console.log('Option 3: Using psql command (if in PATH)');
  console.log(`  psql -U ${user} -h ${host} -p ${port} -c "CREATE DATABASE ${database};"\n`);
  
  const answer = await question('Have you created the database? (yes/no): ');
  rl.close();
  
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('\n✅ Great! Next steps:');
    console.log('   1. Run: npm run prisma:generate');
    console.log('   2. Run: npm run prisma:migrate');
    console.log('   3. Run: npm run dev\n');
  } else {
    console.log('\n💡 Please create the database using one of the options above,');
    console.log('   then run this script again.\n');
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
