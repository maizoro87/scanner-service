import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'scanner-microservice-light',
    engine: 'puppeteer'
  });
});

// Main scanner endpoint
app.post('/scan', async (req, res) => {
  const { url, options = {} } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL is required' 
    });
  }
  
  console.log(`📡 Scanning URL: ${url}`);
  
  let browser;
  try {
    // Launch Puppeteer with minimal resources
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to URL with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);
    
    // Extract basic data
    const data = await page.evaluate(() => {
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el ? el.getAttribute('content') : null;
      };
      
      return {
        metadata: {
          title: document.title,
          description: getMeta('description'),
          ogImage: getMeta('og:image'),
          keywords: getMeta('keywords')
        },
        content: {
          headings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText).slice(0, 10),
          text: document.body.innerText?.substring(0, 5000)
        }
      };
    });
    
    await browser.close();
    
    console.log(`✅ Successfully scanned: ${url}`);
    
    res.json({
      success: true,
      data: {
        url,
        ...data,
        scannedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Scan error for ${url}:`, error.message);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      url
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Scanner Microservice',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'POST /scan': 'Scan a website'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Scanner microservice running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});