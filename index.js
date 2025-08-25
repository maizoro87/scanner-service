// scanner-service/index.js
// Standalone scanner microservice that can run anywhere (Bolt, VPS, Local, etc.)

import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Parse PORT with validation
let PORT = process.env.PORT || 3001;
// Ensure PORT is a valid number
if (PORT && isNaN(parseInt(PORT))) {
  console.warn(`Invalid PORT value: ${PORT}, using default 3001`);
  PORT = 3001;
} else {
  PORT = parseInt(PORT);
}

// CORS configuration - update with your Replit URL
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.MAIN_APP_URL || 'https://your-app.replit.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// Simple API key authentication
const API_KEY = process.env.SCANNER_API_KEY || 'your-secret-api-key-here';

const authenticateRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'scanner-microservice',
    playwright: 'available',
    puppeteer: 'available'
  });
});

// Main scanner endpoint
app.post('/scan', authenticateRequest, async (req, res) => {
  const { url, engine = 'playwright', options = {} } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  console.log(`📡 Scan request received for ${url} using ${engine}`);
  
  try {
    let result;
    
    if (engine === 'puppeteer') {
      result = await scanWithPuppeteer(url, options);
    } else {
      result = await scanWithPlaywright(url, options);
    }
    
    res.json({
      success: true,
      engine,
      data: result
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Playwright scanner
async function scanWithPlaywright(url, options) {
  console.log('🎭 Using Playwright scanner...');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewportSize({
      width: options.viewport?.width || 1920,
      height: options.viewport?.height || 1080
    });
    
    // Navigate to URL
    console.log(`📍 Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Wait for content to load
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { 
        timeout: 5000 
      }).catch(() => console.log('Selector not found, continuing...'));
    }
    
    // Additional wait for dynamic content
    await page.waitForTimeout(2000);
    
    // Extract metadata
    const metadata = await page.evaluate(() => {
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el ? el.getAttribute('content') : null;
      };
      
      return {
        title: document.title,
        description: getMeta('description'),
        keywords: getMeta('keywords'),
        ogTitle: getMeta('og:title'),
        ogDescription: getMeta('og:description'),
        ogImage: getMeta('og:image'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href')
      };
    });
    
    // Extract content
    const content = await page.evaluate(() => {
      // Get structured data
      const structuredData = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
          structuredData.push(JSON.parse(script.textContent));
        } catch (e) {}
      });
      
      // Get main content
      const mainContent = document.querySelector('main, .main-content, #content, article, .container');
      const textContent = mainContent ? mainContent.innerText : document.body.innerText;
      
      // Get links
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText?.trim(),
        href: a.href
      })).filter(l => l.text && l.href).slice(0, 50);
      
      // Get images
      const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt
      })).filter(i => i.src).slice(0, 20);
      
      return {
        structuredData,
        text: textContent?.substring(0, 10000),
        links,
        images,
        hasVideo: document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0
      };
    });
    
    // Extract pricing if requested
    let pricing = null;
    if (options.extractPricing) {
      pricing = await page.evaluate(() => {
        const priceElements = document.querySelectorAll(
          '.pricing, .price, [data-price], .cost, .plan, .tier'
        );
        
        const prices = [];
        priceElements.forEach(el => {
          const text = el.innerText?.trim();
          if (text && (text.includes('$') || text.toLowerCase().includes('free'))) {
            prices.push(text);
          }
        });
        
        return prices.length > 0 ? prices.join(' | ') : null;
      });
    }
    
    // Extract features if requested
    let features = [];
    if (options.extractFeatures) {
      features = await page.evaluate(() => {
        const featureElements = document.querySelectorAll(
          '.features li, .feature-list li, .benefits li, .feature-item'
        );
        
        const featureList = [];
        featureElements.forEach(el => {
          const text = el.innerText?.trim();
          if (text && text.length > 5 && text.length < 200) {
            featureList.push(text);
          }
        });
        
        return [...new Set(featureList)].slice(0, 15);
      });
    }
    
    // Take screenshot if requested
    let screenshot = null;
    if (options.screenshot) {
      console.log('📸 Taking screenshot...');
      const screenshotBuffer = await page.screenshot({
        fullPage: false,
        type: 'png'
      });
      screenshot = screenshotBuffer.toString('base64');
    }
    
    console.log('✅ Scan complete!');
    
    return {
      url,
      metadata,
      content,
      pricing,
      features,
      screenshot,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
}

// Puppeteer scanner (fallback for environments where Playwright doesn't work)
async function scanWithPuppeteer(url, options) {
  console.log('🐶 Using Puppeteer scanner...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: options.viewport?.width || 1920,
      height: options.viewport?.height || 1080
    });
    
    // Navigate to URL
    console.log(`📍 Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content
    await page.waitForTimeout(2000);
    
    // Extract data (similar to Playwright)
    const data = await page.evaluate(() => {
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el ? el.getAttribute('content') : null;
      };
      
      return {
        metadata: {
          title: document.title,
          description: getMeta('description'),
          ogImage: getMeta('og:image')
        },
        content: {
          text: document.body.innerText?.substring(0, 10000)
        }
      };
    });
    
    // Take screenshot if requested
    let screenshot = null;
    if (options.screenshot) {
      const screenshotBuffer = await page.screenshot({
        fullPage: false,
        type: 'png'
      });
      screenshot = screenshotBuffer.toString('base64');
    }
    
    console.log('✅ Scan complete!');
    
    return {
      url,
      ...data,
      screenshot,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     Scanner Microservice Started! 🚀       ║
╠════════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  Engines: Playwright & Puppeteer          ║
║  Status: Ready to scan!                   ║
╚════════════════════════════════════════════╝

API Endpoints:
  GET  /health - Health check
  POST /scan   - Scan a website

Example request:
  curl -X POST http://localhost:${PORT}/scan \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: ${API_KEY}" \\
    -d '{"url": "https://example.com", "engine": "playwright"}'
  `);
});