// Enhanced Scanner Service
const { chromium } = require('playwright');
const OpenAI = require('openai');
const NodeCache = require('node-cache');

class PlaywrightScanner {
  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    this.cache = new NodeCache({ stdTTL: 3600 });
    console.log('🚀 Playwright Scanner initialized');
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
        errors: []
      }
    };

    let browser = null;
    
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Try to use system Chrome if Playwright browsers not installed
        executablePath: process.env.CHROME_BIN || undefined
      });

      // Scan each URL
      for (const [urlType, url] of Object.entries(urls)) {
        if (url) {
          await this.scanUrl(browser, url, urlType, toolName, result);
        }
      }

      // Generate AI insights if API key is available
      if (process.env.OPENAI_API_KEY) {
        await this.generateAIInsights(result, toolName);
      }

    } catch (error) {
      console.error('Scan error:', error);
      result.metadata.errors.push(error.message);
    } finally {
      if (browser) await browser.close();
    }

    result.metadata.urlsScanned = Object.values(urls).filter(Boolean).length;
    result.metadata.resourcesFound = this.countResources(result.categorizedResources);
    result.metadata.aiAnalysisTime = Date.now() - startTime;

    return result;
  }

  async scanUrl(browser, url, urlType, toolName, result) {
    let page = null;
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Extract page data
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
          
          // If no text, try to generate from URL
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

      // Process extracted data
      this.processPageData(pageData, urlType, url, toolName, result);
      
    } catch (error) {
      console.error(`Error scanning ${url}:`, error.message);
      result.metadata.errors.push(`${urlType}: ${error.message}`);
    } finally {
      if (page) await page.close();
    }
  }

  processPageData(pageData, urlType, url, toolName, result) {
    // Add main page as resource
    const mainResource = {
      title: pageData.title || `${toolName} ${urlType} Page`,
      url: url,
      description: pageData.description || '',
      type: 'documentation',
      source: urlType
    };
    
    result.categorizedResources.documentation.push(mainResource);

    // Process links
    const processedUrls = new Set([url]);
    
    for (const link of pageData.links) {
      if (!link.href || processedUrls.has(link.href)) continue;
      processedUrls.add(link.href);

      let title = link.text || link.title || '';
      
      // Generate title from URL if needed
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
      const prompt = `Analyze ${toolName} for teachers. Provide JSON with: toolOverview (2-3 sentences), teacherBenefits (5 items), commonUseCases (5 items), setupComplexity (easy/medium/complex), bestFeatures (5 items)`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const insights = JSON.parse(content);
          Object.assign(result.aiInsights, insights);
        } catch {
          console.warn('Failed to parse AI response');
        }
      }
    } catch (error) {
      console.error('AI insights error:', error.message);
    }
  }

  countResources(resources) {
    return Object.values(resources).reduce((total, category) => total + category.length, 0);
  }
}

module.exports = { PlaywrightScanner };