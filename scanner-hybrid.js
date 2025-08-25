// Hybrid Scanner - Uses Playwright when available, falls back to Puppeteer
const NodeCache = require('node-cache');

class HybridScanner {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 });
    this.scannerType = null;
    this.initializeScanner();
  }

  async initializeScanner() {
    // Try Playwright first
    try {
      const { chromium } = require('playwright');
      const testBrowser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      await testBrowser.close();
      this.scannerType = 'playwright';
      console.log('✅ Using Playwright scanner');
    } catch (error) {
      console.log('⚠️ Playwright not available, falling back to Puppeteer');
      try {
        const puppeteer = require('puppeteer');
        this.scannerType = 'puppeteer';
        console.log('✅ Using Puppeteer scanner');
      } catch (puppeteerError) {
        console.error('❌ Neither Playwright nor Puppeteer available');
        this.scannerType = 'basic';
      }
    }
  }

  async performDeepTargetedScan(urls, toolName) {
    const startTime = Date.now();
    
    const result = {
      urls: urls,
      name: toolName,
      description: '',
      categorizedResources: {
        documentation: [],
        tutorials: [],
        videos: [],
        integrations: [],
        faqs: [],
        training: []
      },
      aiInsights: {
        toolOverview: '',
        teacherBenefits: [],
        commonUseCases: [],
        setupComplexity: 'medium',
        bestFeatures: []
      },
      metadata: {
        scannedAt: new Date(),
        urlsScanned: 0,
        resourcesFound: 0,
        aiAnalysisTime: 0,
        scannerType: this.scannerType,
        errors: []
      }
    };

    if (this.scannerType === 'basic') {
      // Basic fetch-based scanning
      for (const [urlType, url] of Object.entries(urls)) {
        if (url) {
          await this.basicScan(url, urlType, toolName, result);
        }
      }
    } else {
      // Browser-based scanning
      let browser = null;
      
      try {
        if (this.scannerType === 'playwright') {
          const { chromium } = require('playwright');
          browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        } else {
          const puppeteer = require('puppeteer');
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        }

        for (const [urlType, url] of Object.entries(urls)) {
          if (url) {
            await this.browserScan(browser, url, urlType, toolName, result);
          }
        }
      } catch (error) {
        console.error('Browser scan error:', error);
        result.metadata.errors.push(error.message);
        
        // Fallback to basic scan
        for (const [urlType, url] of Object.entries(urls)) {
          if (url) {
            await this.basicScan(url, urlType, toolName, result);
          }
        }
      } finally {
        if (browser) await browser.close();
      }
    }

    // Generate AI insights if API key available
    if (process.env.OPENAI_API_KEY) {
      await this.generateAIInsights(result, toolName);
    }

    result.metadata.urlsScanned = Object.values(urls).filter(Boolean).length;
    result.metadata.resourcesFound = this.countResources(result.categorizedResources);
    result.metadata.aiAnalysisTime = Date.now() - startTime;

    return result;
  }

  async browserScan(browser, url, urlType, toolName, result) {
    let page = null;
    
    try {
      if (this.scannerType === 'playwright') {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        page = await context.newPage();
      } else {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      }
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const pageData = await page.evaluate(() => {
        const getText = (element) => {
          if (!element) return '';
          return (element.getAttribute('aria-label') || 
                  element.getAttribute('title') || 
                  element.textContent || '').trim();
        };

        const links = Array.from(document.querySelectorAll('a[href]')).map(link => {
          const href = link.getAttribute('href') || '';
          let text = getText(link);
          
          if (!text && href) {
            const urlParts = href.split('/').filter(Boolean);
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart) {
              text = lastPart.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
            }
          }
          
          return { text, href, title: link.getAttribute('title') || '' };
        });

        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          links: links.slice(0, 50)
        };
      });

      this.processPageData(pageData, urlType, url, toolName, result);
    } catch (error) {
      console.error(`Error scanning ${url}:`, error.message);
      result.metadata.errors.push(`${urlType}: ${error.message}`);
    } finally {
      if (page) await page.close();
    }
  }

  async basicScan(url, urlType, toolName, result) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : `${toolName} ${urlType} Page`;
      
      // Extract description
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      const description = descMatch ? descMatch[1] : '';
      
      // Add as resource
      const resource = {
        title: title,
        url: url,
        description: description || `${toolName} resource`,
        type: 'documentation',
        source: urlType
      };
      
      result.categorizedResources.documentation.push(resource);
      
      // Extract links (basic)
      const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]*)</gi;
      let match;
      let linkCount = 0;
      
      while ((match = linkRegex.exec(html)) && linkCount < 20) {
        const [, href, text] = match;
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const linkTitle = text || href.split('/').pop()?.replace(/[-_]/g, ' ') || 'Resource';
          
          const linkResource = {
            title: linkTitle.substring(0, 200),
            url: href.startsWith('http') ? href : new URL(href, url).toString(),
            description: `${linkTitle} - ${toolName} resource`,
            type: this.categorizeResourceType(linkTitle, href),
            source: urlType
          };
          
          const category = this.determineResourceCategory(linkTitle, href, urlType);
          if (result.categorizedResources[category]) {
            result.categorizedResources[category].push(linkResource);
            linkCount++;
          }
        }
      }
    } catch (error) {
      console.error(`Basic scan error for ${url}:`, error.message);
      result.metadata.errors.push(`${urlType}: ${error.message}`);
    }
  }

  processPageData(pageData, urlType, url, toolName, result) {
    const mainResource = {
      title: pageData.title || `${toolName} ${urlType} Page`,
      url: url,
      description: pageData.description || '',
      type: 'documentation',
      source: urlType
    };
    
    result.categorizedResources.documentation.push(mainResource);

    const processedUrls = new Set([url]);
    
    for (const link of pageData.links) {
      if (!link.href || processedUrls.has(link.href)) continue;
      processedUrls.add(link.href);

      let title = link.text || link.title || '';
      
      if (!title || title.length < 3) {
        try {
          const urlObj = new URL(link.href);
          const segments = urlObj.pathname.split('/').filter(Boolean);
          if (segments.length > 0) {
            title = segments[segments.length - 1]
              .replace(/[-_]/g, ' ')
              .replace(/\.\w+$/, '');
          }
        } catch {
          title = `${toolName} Resource`;
        }
      }

      if (!title || title.length < 3) continue;

      const resource = {
        title: title.substring(0, 200),
        url: link.href,
        description: `${title} - ${toolName} resource`,
        type: this.categorizeResourceType(title, link.href),
        source: urlType
      };

      const category = this.determineResourceCategory(title, link.href, urlType);
      if (result.categorizedResources[category]) {
        result.categorizedResources[category].push(resource);
      }
    }
  }

  categorizeResourceType(title, url) {
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube') || lowerUrl.includes('video')) return 'video';
    if (lowerTitle.includes('tutorial') || lowerTitle.includes('guide')) return 'tutorial';
    if (lowerTitle.includes('documentation') || lowerTitle.includes('docs')) return 'documentation';
    
    return 'other';
  }

  determineResourceCategory(title, url, urlType) {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('tutorial') || lowerTitle.includes('getting started')) return 'tutorials';
    if (lowerTitle.includes('video')) return 'videos';
    if (lowerTitle.includes('training') || lowerTitle.includes('course')) return 'training';
    if (lowerTitle.includes('faq') || lowerTitle.includes('question')) return 'faqs';
    if (lowerTitle.includes('integration')) return 'integrations';
    
    return 'documentation';
  }

  async generateAIInsights(result, toolName) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = `Analyze ${toolName} for teachers. Provide JSON with: toolOverview (2-3 sentences), teacherBenefits (5 items), commonUseCases (5 items), setupComplexity (easy/medium/complex), bestFeatures (5 items)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const insights = JSON.parse(content);
        Object.assign(result.aiInsights, insights);
      }
    } catch (error) {
      console.error('AI insights error:', error.message);
      // Use defaults
      result.aiInsights = {
        toolOverview: `${toolName} is an educational tool for teachers and students.`,
        teacherBenefits: ['Easy to use', 'Saves time', 'Engages students', 'Tracks progress', 'Flexible'],
        commonUseCases: ['Classroom activities', 'Homework', 'Assessment', 'Group work', 'Remote learning'],
        setupComplexity: 'medium',
        bestFeatures: ['User-friendly', 'Interactive', 'Customizable', 'Reports', 'Collaboration']
      };
    }
  }

  countResources(resources) {
    return Object.values(resources).reduce((total, category) => total + category.length, 0);
  }
}

module.exports = HybridScanner;