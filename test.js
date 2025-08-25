// test.js - Test the scanner service
import fetch from 'node-fetch';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3001';
const API_KEY = process.env.SCANNER_API_KEY || 'test-api-key';

async function testScanner() {
  console.log('🧪 Testing Scanner Service\n');
  console.log('=' .repeat(50));
  
  // Test 1: Health Check
  console.log('\n✅ Test 1: Health Check');
  try {
    const health = await fetch(`${SERVICE_URL}/health`);
    const healthData = await health.json();
    console.log('   Status:', healthData.status);
    console.log('   Engines:', healthData.playwright, '&', healthData.puppeteer);
  } catch (error) {
    console.error('   ❌ Health check failed:', error.message);
  }
  
  // Test 2: Basic Scan
  console.log('\n✅ Test 2: Basic Website Scan');
  try {
    const response = await fetch(`${SERVICE_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        url: 'https://example.com',
        engine: 'playwright',
        options: {
          screenshot: false,
          extractFeatures: false
        }
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('   Title:', result.data.metadata?.title);
      console.log('   Content length:', result.data.content?.text?.length, 'chars');
    } else {
      console.log('   Error:', result.error);
    }
  } catch (error) {
    console.error('   ❌ Scan failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Tests complete!\n');
}

testScanner();