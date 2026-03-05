#!/usr/bin/env node

/**
 * Create PostgreSQL Database Script
 * 
 * This script creates the compacturl database without requiring psql command.
 * It uses the pg library to connect directly to PostgreSQL.
 */

const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createDatabase() {
  console.log('\n🗄️  PostgreSQL Database Setup\n');
  
  // Get connection details
  const host = await question('PostgreSQL host (default: localhost): ') || 'localhost';
  const port = await question('PostgreSQL port (default: 5432): ') || '5432';
  const user = await question('PostgreSQL user (default: postgres): ') || 'postgres';
  const password = await question('PostgreSQL password: ');
  
  rl.close();
  
  console.log('\n📡 Connecting to PostgreSQL...');
  
  // Connect to default postgres database
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database: 'postgres' // Connect to default database first
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if database exists
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'compacturl'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ️  Database "compacturl" already exists');
    } else {
      // Create database
      console.log('📦 Creating database "compacturl"...');
      await client.query('CREATE DATABASE compacturl');
      console.log('✅ Database "compacturl" created successfully!');
    }
    
    await client.end();
    
    // Generate DATABASE_URL
    console.log('\n📝 Your DATABASE_URL for .env file:');
    console.log(`\nDATABASE_URL="postgresql://${user}:${password}@${host}:${port}/compacturl?connection_limit=20&pool_timeout=10&connect_timeout=10"\n`);
    console.log('Copy this to your .env file!\n');
    
    console.log('✅ Setup complete! Next steps:');
    console.log('   1. Update DATABASE_URL in .env file');
    console.log('   2. Run: npm run prisma:generate');
    console.log('   3. Run: npm run prisma:migrate');
    console.log('   4. Run: npm run dev\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 PostgreSQL is not running or not accessible.');
      console.error('   Make sure PostgreSQL service is started.\n');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed.');
      console.error('   Check your PostgreSQL username and password.\n');
    } else {
      console.error('\n💡 Please check your PostgreSQL installation and credentials.\n');
    }
    
    process.exit(1);
  }
}

// Check if pg is installed
try {
  require.resolve('pg');
  createDatabase();
} catch (e) {
  console.log('\n📦 Installing required package "pg"...\n');
  const { execSync } = require('child_process');
  try {
    execSync('npm install --save-dev pg', { stdio: 'inherit' });
    console.log('\n✅ Package installed. Running setup...\n');
    createDatabase();
  } catch (error) {
    console.error('\n❌ Failed to install pg package.');
    console.error('   Please run: npm install --save-dev pg\n');
    process.exit(1);
  }
}
