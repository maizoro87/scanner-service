# Scanner Microservice

Standalone browser automation service for the SMCHS Innovation Hub. This service runs Playwright/Puppeteer to extract fresh, dynamic content from educational websites.

## Deployment Options & Costs

### 1. **DigitalOcean** ($6/month recommended)
```bash
# Create a $6/month droplet (1GB RAM)
# SSH into droplet and run:
git clone [your-repo]
cd scanner-service
npm install
npx playwright install-deps
npx playwright install chromium
npm start
```

### 2. **Render.com** (FREE)
- Deploy directly from GitHub
- Free 750 hours/month
- Auto-deploys on push
- ⚠️ Spins down after 15 min inactivity

### 3. **Railway.app** (~$5/month)
```bash
# Install Railway CLI
railway login
railway init
railway up
```

### 4. **Google Cloud Run** (Pay per use, ~$0-5/month)
```dockerfile
FROM node:18-slim
RUN npx playwright install-deps chromium
WORKDIR /app
COPY . .
RUN npm install
RUN npx playwright install chromium
CMD ["npm", "start"]
```

### 5. **Local + ngrok** (FREE for development)
```bash
# Terminal 1: Run scanner
cd scanner-service
npm install
npm start

# Terminal 2: Expose with ngrok
ngrok http 3001
# Copy the HTTPS URL for your Replit app
```

## Quick Start

### 1. Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your settings:
# - SCANNER_API_KEY (generate a secure key)
# - MAIN_APP_URL (your Replit app URL)
```

### 2. Install Dependencies
```bash
npm install
npx playwright install chromium
# OR if Playwright fails:
# The service will auto-fallback to Puppeteer
```

### 3. Run the Service
```bash
npm start
# Service runs on http://localhost:3001
```

### 4. Update Your Replit App
Add to your Replit secrets:
```
SCANNER_SERVICE_URL=https://your-scanner-service.com
SCANNER_API_KEY=your-secret-key-here
```

## API Usage

### Health Check
```bash
curl http://localhost:3001/health
```

### Scan a Website
```bash
curl -X POST http://localhost:3001/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "url": "https://kahoot.com",
    "engine": "playwright",
    "options": {
      "screenshot": true,
      "extractPricing": true,
      "extractFeatures": true
    }
  }'
```

## How It Works

1. **Your Replit App** detects "Deep Scan" is selected
2. **Calls this scanner service** via API
3. **Scanner launches real browser** (Chrome)
4. **Extracts complete content** including JavaScript-rendered elements
5. **Returns fresh data** back to your app
6. **Your app displays results** with current 2024-2025 information

## Troubleshooting

### Playwright Won't Install
- Use Puppeteer instead (auto-fallback)
- Or try: `npm install puppeteer-core chrome-aws-lambda`

### Out of Memory
- Upgrade to 2GB droplet ($12/month)
- Or limit concurrent scans to 1

### Slow Performance
- Normal: 10-15 seconds per scan
- Cache results for 24 hours
- Use quick scan for non-critical tools

## Security

- **API Key Required**: All scan requests need X-API-Key header
- **CORS Protection**: Only your app can call the service
- **Rate Limiting**: Add if needed with express-rate-limit
- **Input Validation**: URLs are validated before scanning

## Monitoring

Check service health:
```bash
curl https://your-service.com/health
```

View logs (DigitalOcean):
```bash
pm2 logs scanner-service
```

## Cost Optimization

- **Cache aggressively**: Store results for 24 hours minimum
- **Use queues**: Process scans asynchronously
- **Auto-scale down**: Use Cloud Run or Lambda for pay-per-use
- **Batch scans**: Scan multiple tools in one browser session