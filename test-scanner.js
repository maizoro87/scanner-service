#!/usr/bin/env node

// Simple test script for the scanner service
const baseUrl = process.argv[2] || 'http://localhost:3000';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`\nTesting ${method} ${endpoint}...`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
    
    return response.status === 200;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`🧪 Testing Scanner Service at ${baseUrl}`);
  console.log('=' .repeat(50));
  
  // Test health check
  await testEndpoint('/');
  
  // Test basic scan
  await testEndpoint('/scan', 'POST', {
    url: 'https://www.kahoot.com'
  });
  
  // Test targeted scan
  await testEndpoint('/targeted-scan', 'POST', {
    urls: {
      main: 'https://www.kahoot.com',
      helpCenter: 'https://support.kahoot.com'
    },
    toolName: 'Kahoot'
  });
  
  // Test deep scan
  await testEndpoint('/deep-scan', 'POST', {
    url: 'https://www.kahoot.com',
    toolName: 'Kahoot'
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Tests complete!');
}

runTests().catch(console.error);