import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'scanner-simple',
    mode: 'fetch-only'
  });
});

// Simple scan endpoint (no browser needed)
app.post('/scan', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL is required' 
    });
  }
  
  try {
    console.log(`Fetching: ${url}`);
    
    // Simple fetch without browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScannerBot/1.0)'
      }
    });
    
    const html = await response.text();
    
    // Extract basic info from HTML
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    
    res.json({
      success: true,
      data: {
        url,
        title: titleMatch ? titleMatch[1] : 'No title',
        description: descMatch ? descMatch[1] : 'No description',
        contentLength: html.length,
        scannedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'Scanner Simple',
    status: 'running'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});