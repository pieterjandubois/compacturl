#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Run this after deploying to verify all services are working
 * 
 * Usage: node verify-deployment.js <your-vercel-url>
 * Example: node verify-deployment.js https://compacturl.vercel.app
 */

const https = require('https');
const http = require('http');

const VERCEL_URL = process.argv[2];

if (!VERCEL_URL) {
  console.error('❌ Error: Please provide your Vercel URL');
  console.log('Usage: node verify-deployment.js <your-vercel-url>');
  console.log('Example: node verify-deployment.js https://compacturl.vercel.app');
  process.exit(1);
}

console.log('🔍 Verifying deployment at:', VERCEL_URL);
console.log('');

const tests = [];
let passed = 0;
let failed = 0;

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    client.get(url, (res) => {
      const duration = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          duration
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('Running deployment verification tests...\n');
  
  // Test 1: Homepage loads
  await test('Homepage loads', async () => {
    const res = await makeRequest(VERCEL_URL);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (!res.body.includes('CompactURL')) {
      throw new Error('Homepage does not contain "CompactURL"');
    }
    console.log(`   Response time: ${res.duration}ms`);
  });
  
  // Test 2: HTTPS is enforced
  await test('HTTPS is enforced', async () => {
    if (!VERCEL_URL.startsWith('https://')) {
      throw new Error('URL should use HTTPS');
    }
  });
  
  // Test 3: API endpoint responds
  await test('API health check', async () => {
    const res = await makeRequest(`${VERCEL_URL}/api/auth/session`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    console.log(`   Response time: ${res.duration}ms`);
  });
  
  // Test 4: Security headers present
  await test('Security headers present', async () => {
    const res = await makeRequest(VERCEL_URL);
    const headers = res.headers;
    
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
    ];
    
    const missing = requiredHeaders.filter(h => !headers[h]);
    if (missing.length > 0) {
      throw new Error(`Missing headers: ${missing.join(', ')}`);
    }
  });
  
  // Test 5: Static assets load
  await test('Static assets accessible', async () => {
    const res = await makeRequest(`${VERCEL_URL}/favicon.ico`);
    if (res.statusCode !== 200 && res.statusCode !== 304) {
      throw new Error(`Expected 200 or 304, got ${res.statusCode}`);
    }
  });
  
  // Test 6: Login page loads
  await test('Login page loads', async () => {
    const res = await makeRequest(`${VERCEL_URL}/login`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (!res.body.includes('login') && !res.body.includes('Login')) {
      throw new Error('Login page does not contain login form');
    }
  });
  
  // Test 7: Register page loads
  await test('Register page loads', async () => {
    const res = await makeRequest(`${VERCEL_URL}/register`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (!res.body.includes('register') && !res.body.includes('Register')) {
      throw new Error('Register page does not contain registration form');
    }
  });
  
  // Test 8: 404 page works
  await test('404 page works', async () => {
    const res = await makeRequest(`${VERCEL_URL}/this-page-does-not-exist-12345`);
    if (res.statusCode !== 404) {
      throw new Error(`Expected 404, got ${res.statusCode}`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your deployment looks good.');
    console.log('\nNext steps:');
    console.log('1. Test user registration and email verification');
    console.log('2. Test URL shortening functionality');
    console.log('3. Test dashboard features');
    console.log('4. Monitor Vercel logs for any errors');
    console.log('5. Set up monitoring and alerts');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    console.log('\nTroubleshooting:');
    console.log('1. Check Vercel deployment logs');
    console.log('2. Verify environment variables are set');
    console.log('3. Ensure database migrations have run');
    console.log('4. Check function logs in Vercel dashboard');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
