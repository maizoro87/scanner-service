const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
// Ensure PORT is a valid number - handle Render's port format
let PORT = 3000; // default
if (process.env.PORT) {
  const parsedPort = parseInt(process.env.PORT);
  if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
    PORT = parsedPort;
  } else {
    console.warn(`Invalid PORT value: ${process.env.PORT}, using default 3000`);
  }
}

// Import scanner service
const { PlaywrightScanner } = require('./scanner');

// Initialize scanner
const playwrightScanner = new PlaywrightScanner();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoints for Render
app.get('/', (req, res) => {
  res.json({ 
    service: 'Scanner Service Enhanced',
    version: '2.0.0',
    status: 'running',
    port: PORT,
    features: ['playwright', 'ai-insights', 'targeted-scan', 'resource-extraction']
  });
});

// Additional health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Basic scan endpoint (backwards compatible)
app.post('/scan', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Use Playwright scanner for basic scan
    const result = await playwrightScanner.performDeepTargetedScan(
      { main: url },
      'Tool'
    );
    
    res.json({
      success: true,
      data: {
        url,
        title: result.name || 'Unknown',
        description: result.description || '',
        resourcesFound: result.metadata.resourcesFound,
        categories: {
          documentation: result.categorizedResources.documentation.length,
          tutorials: result.categorizedResources.tutorials.length,
          videos: result.categorizedResources.videos.length,
          faqs: result.categorizedResources.faqs.length
        },
        scannedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Enhanced targeted scan endpoint
app.post('/targeted-scan', async (req, res) => {
  try {
    const { urls, toolName } = req.body;
    
    if (!urls || !toolName) {
      return res.status(400).json({ 
        error: 'Missing required parameters: urls and toolName' 
      });
    }
    
    console.log(`Starting targeted scan for ${toolName}...`);
    
    // Use Playwright scanner for better results
    const result = await playwrightScanner.performDeepTargetedScan(urls, toolName);
    
    res.json({
      success: true,
      toolName,
      resourcesFound: result.metadata.resourcesFound,
      categories: {
        documentation: result.categorizedResources.documentation.length,
        tutorials: result.categorizedResources.tutorials.length,
        videos: result.categorizedResources.videos.length,
        integrations: result.categorizedResources.integrations.length,
        faqs: result.categorizedResources.faqs.length,
        training: result.categorizedResources.training.length
      },
      resources: result.categorizedResources,
      aiInsights: result.aiInsights,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Targeted scan error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Deep scan endpoint with AI insights
app.post('/deep-scan', async (req, res) => {
  try {
    const { url, toolName } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const name = toolName || 'Educational Tool';
    
    // Use Playwright scanner for deep analysis
    const result = await playwrightScanner.performDeepTargetedScan(
      { main: url },
      name
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Deep scan error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test endpoint for Playwright scanner
app.post('/test-playwright', async (req, res) => {
  try {
    const { urls, toolName } = req.body;
    
    if (!urls || !toolName) {
      return res.status(400).json({ error: 'Missing urls or toolName' });
    }
    
    console.log('Testing Playwright Scanner with:', { urls, toolName });
    
    const scanResult = await playwrightScanner.performDeepTargetedScan(urls, toolName);
    
    res.json({
      success: true,
      resourcesFound: scanResult.metadata.resourcesFound,
      sampleResources: {
        documentation: scanResult.categorizedResources.documentation.slice(0, 3),
        tutorials: scanResult.categorizedResources.tutorials.slice(0, 3)
      },
      insights: scanResult.aiInsights,
      errors: scanResult.metadata.errors
    });
  } catch (error) {
    console.error('Playwright test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server - bind to 0.0.0.0 for Render
const HOST = '0.0.0.0';
console.log(`Starting server with PORT=${PORT} (env.PORT=${process.env.PORT})`);

app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 Enhanced Scanner Service running on ${HOST}:${PORT}`);
  console.log(`Features: Playwright browser automation, AI insights, resource extraction`);
  console.log(`Endpoints:`);
  console.log(`  POST /scan - Basic URL scanning`);
  console.log(`  POST /targeted-scan - Multi-URL targeted scanning`);
  console.log(`  POST /deep-scan - Deep analysis with AI`);
  console.log(`  POST /test-playwright - Test Playwright scanner`);
});