import { chromium, Browser, Page, BrowserContext } from 'playwright';
import OpenAI from 'openai';
import NodeCache from 'node-cache';

interface TargetedUrls {
  main?: string;
  helpCenter?: string;
  tutorials?: string;
  videos?: string;
  integrations?: string;
  faq?: string;
  training?: string;
  api?: string;
  pricing?: string;
}

interface DeepResource {
  title: string;
  url: string;
  description: string;
  type: string;
  source: string;
  verified: boolean;
  aiAnalysis?: {
    relevanceScore: number;
    teacherValue: string;
    quickTips: string[];
  };
}

interface EnhancedCategorizedResources {
  documentation: DeepResource[];
  tutorials: DeepResource[];
  videos: DeepResource[];
  integrations: DeepResource[];
  faqs: DeepResource[];
  training: DeepResource[];
}

interface DeepScanResult {
  urls: TargetedUrls;
  name?: string;
  description?: string;
  logo?: string;
  categorizedResources: EnhancedCategorizedResources;
  aiInsights: {
    toolOverview: string;
    teacherBenefits: string[];
    commonUseCases: string[];
    setupComplexity: 'easy' | 'medium' | 'complex';
    bestFeatures: string[];
  };
  metadata: {
    scannedAt: Date;
    urlsScanned: number;
    resourcesFound: number;
    aiAnalysisTime: number;
    errors: string[];
  };
}

export class PlaywrightScanner {
  private openai: OpenAI;
  private cache: NodeCache;
  private browser: Browser | null = null;
  
  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    // Cache for 1 hour
    this.cache = new NodeCache({ stdTTL: 3600 });
    
    console.log('🚀 Playwright Scanner initialized');
  }

  async performDeepTargetedScan(urls: TargetedUrls, toolName: string): Promise<DeepScanResult> {
    const startTime = Date.now();
    
    const result: DeepScanResult = {
      urls: urls,
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

    console.log(`[Playwright Scanner] Starting deep scan of ${Object.keys(urls).length} URLs for ${toolName}`);

    try {
      // Launch browser once for all scans
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Phase 1: Deep scan each URL
      const scanPromises = [];
      
      for (const [urlType, url] of Object.entries(urls)) {
        if (url) {
          scanPromises.push(this.deepScanSingleUrl(url, urlType as keyof TargetedUrls, toolName, result));
        }
      }

      // Execute all deep scans in parallel
      await Promise.allSettled(scanPromises);

      // Phase 2: AI-powered insights generation
      await this.generateAIInsights(result, toolName);

      // Phase 3: Enhance resources with AI analysis
      await this.enhanceResourcesWithAI(result, toolName);

      // Extract basic tool information from main page resources
      if (urls.main && result.categorizedResources.documentation.length > 0) {
        const mainResource = result.categorizedResources.documentation.find(r => r.source === 'main_page');
        if (mainResource) {
          result.name = toolName; // Use provided tool name
          result.description = mainResource.description || '';
        }
      }

    } finally {
      // Always close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }

    // Update metadata
    result.metadata.urlsScanned = Object.values(urls).filter(Boolean).length;
    result.metadata.resourcesFound = this.countResources(result.categorizedResources);
    result.metadata.aiAnalysisTime = Date.now() - startTime;

    console.log(`[Playwright Scanner] Deep scan completed in ${result.metadata.aiAnalysisTime}ms`);
    console.log(`Found ${result.metadata.resourcesFound} resources across ${result.metadata.urlsScanned} URLs`);

    return result;
  }

  private async deepScanSingleUrl(url: string, urlType: keyof TargetedUrls, toolName: string, result: DeepScanResult): Promise<void> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      console.log(`[Playwright Scanner] Deep scanning ${urlType}: ${url}`);
      
      // Create a new context for isolation
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      page = await context.newPage();
      
      // Navigate with retry logic
      let retries = 3;
      let pageLoaded = false;
      
      while (retries > 0 && !pageLoaded) {
        try {
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          // Wait for any dynamic content
          await page.waitForTimeout(2000);
          
          // Check if we hit a protection page
          const pageTitle = await page.title();
          const isProtected = pageTitle.toLowerCase().includes('just a moment') || 
                             pageTitle.toLowerCase().includes('cloudflare');
          
          if (isProtected && retries > 1) {
            console.log(`[Playwright Scanner] Protection detected, retrying...`);
            await page.waitForTimeout(5000);
            retries--;
            continue;
          }
          
          pageLoaded = true;
        } catch (error) {
          console.warn(`[Playwright Scanner] Navigation attempt failed, retries left: ${retries - 1}`);
          retries--;
          if (retries === 0) throw error;
        }
      }

      // Extract comprehensive page data with Playwright's powerful selectors
      const pageData = await page.evaluate(() => {
        // Helper function to extract text safely
        const getText = (element: Element | null): string => {
          if (!element) return '';
          // Try to get aria-label first, then title, then text content
          return (element.getAttribute('aria-label') || 
                  element.getAttribute('title') || 
                  element.textContent || '').trim();
        };

        // Helper to get absolute URL
        const getAbsoluteUrl = (href: string): string => {
          try {
            return new URL(href, window.location.href).toString();
          } catch {
            return '';
          }
        };

        // Extract all links with better logic
        const links = Array.from(document.querySelectorAll('a[href]')).map(link => {
          const href = link.getAttribute('href') || '';
          const text = getText(link);
          
          // If no text, try to find text from child elements
          let extractedText = text;
          if (!extractedText) {
            // Check for images with alt text
            const img = link.querySelector('img');
            if (img) {
              extractedText = img.getAttribute('alt') || img.getAttribute('title') || '';
            }
            
            // Check for spans or divs with text
            if (!extractedText) {
              const textElement = link.querySelector('span, div, p');
              if (textElement) {
                extractedText = getText(textElement);
              }
            }
            
            // Last resort: use href filename
            if (!extractedText && href) {
              const urlParts = href.split('/').filter(Boolean);
              const lastPart = urlParts[urlParts.length - 1];
              if (lastPart && !lastPart.includes('?')) {
                extractedText = lastPart.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
              }
            }
          }
          
          return {
            text: extractedText,
            href: getAbsoluteUrl(href),
            title: link.getAttribute('title') || '',
            ariaLabel: link.getAttribute('aria-label') || ''
          };
        }).filter(link => link.href && link.href.startsWith('http'));

        // Extract navigation and important sections
        const navLinks = Array.from(document.querySelectorAll('nav a, header a, .navigation a, .menu a')).map(link => ({
          text: getText(link),
          href: getAbsoluteUrl(link.getAttribute('href') || '')
        }));

        // Look for resource sections
        const resourceSections = Array.from(document.querySelectorAll('[class*="resource"], [class*="help"], [class*="support"], [class*="documentation"], [class*="tutorial"], [class*="guide"]'));
        const resourceLinks = resourceSections.flatMap(section => 
          Array.from(section.querySelectorAll('a')).map(link => ({
            text: getText(link),
            href: getAbsoluteUrl(link.getAttribute('href') || ''),
            context: getText(section.querySelector('h1, h2, h3, h4, h5, h6'))
          }))
        );

        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
          headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => getText(h)).filter(Boolean).slice(0, 20),
          links: links.slice(0, 50), // Get more links
          navLinks: navLinks,
          resourceLinks: resourceLinks,
          paragraphs: Array.from(document.querySelectorAll('p')).map(p => getText(p)).filter(t => t.length > 50).slice(0, 10),
          lists: Array.from(document.querySelectorAll('ul li, ol li')).map(li => getText(li)).filter(Boolean).slice(0, 20)
        };
      });

      // Process the extracted data
      await this.processPageData(pageData, urlType, url, toolName, result);
      
    } catch (error) {
      console.error(`[Playwright Scanner] Error scanning ${urlType} (${url}):`, error);
      result.metadata.errors.push(`${urlType} scan failed: ${(error as Error).message}`);
    } finally {
      // Clean up
      if (page) await page.close();
      if (context) await context.close();
    }
  }

  private async processPageData(pageData: any, urlType: keyof TargetedUrls, url: string, toolName: string, result: DeepScanResult): Promise<void> {
    // Add the main page as a resource
    const mainResource: DeepResource = {
      title: pageData.title || `${toolName} ${urlType} Page`,
      url: url,
      description: pageData.description || `${toolName} ${urlType} resource page`,
      type: this.categorizeResourceType(pageData.title || '', url),
      source: 'main_page',
      verified: true
    };

    const mainCategory = this.determineResourceCategory(mainResource.title, url, urlType);
    if (result.categorizedResources[mainCategory]) {
      result.categorizedResources[mainCategory].push(mainResource);
    }

    // Process all extracted links
    const allLinks = [
      ...pageData.links,
      ...pageData.navLinks,
      ...pageData.resourceLinks
    ];

    const processedUrls = new Set<string>();
    processedUrls.add(url); // Don't re-add the main URL

    for (const link of allLinks) {
      if (!link.href || processedUrls.has(link.href)) continue;
      processedUrls.add(link.href);

      // Generate a meaningful title
      let title = link.text || link.ariaLabel || link.title || '';
      
      // If still no title, generate from URL
      if (!title || title.length < 3) {
        try {
          const urlObj = new URL(link.href);
          const pathname = urlObj.pathname;
          const segments = pathname.split('/').filter(Boolean);
          
          if (segments.length > 0) {
            // Take the last meaningful segment
            title = segments[segments.length - 1]
              .replace(/[-_]/g, ' ')
              .replace(/\.\w+$/, '')
              .replace(/\b\w/g, l => l.toUpperCase());
            
            // Add context if available
            if (link.context) {
              title = `${link.context} - ${title}`;
            } else if (segments.length > 1) {
              // Use parent directory as context
              const context = segments[segments.length - 2]
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
              title = `${context} - ${title}`;
            }
          }
          
          // If title is still generic, use domain + path
          if (!title || title.length < 5) {
            title = `${urlObj.hostname.replace('www.', '')} - ${segments.join(' / ')}`;
          }
        } catch {
          // If URL parsing fails, use a generic title
          title = `${toolName} Resource`;
        }
      }

      // Clean up the title
      title = title
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);

      // Skip if we still don't have a meaningful title
      if (!title || title.length < 3) continue;

      // Skip common non-resource links
      const lowerTitle = title.toLowerCase();
      const skipPatterns = ['cookie', 'privacy', 'terms', 'legal', 'copyright', 'trademark'];
      if (skipPatterns.some(pattern => lowerTitle.includes(pattern))) continue;

      const resource: DeepResource = {
        title: title,
        url: link.href,
        description: link.title || `${title} - ${toolName} resource`,
        type: this.categorizeResourceType(title, link.href),
        source: urlType,
        verified: true
      };

      const category = this.determineResourceCategory(title, link.href, urlType);
      if (result.categorizedResources[category]) {
        result.categorizedResources[category].push(resource);
      }
    }

    // Extract logo if on main page
    if (urlType === 'main' && pageData.ogImage) {
      result.logo = pageData.ogImage;
    }
  }

  private determineResourceCategory(title: string, url: string, urlType: keyof TargetedUrls): keyof EnhancedCategorizedResources {
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    // Direct mapping for URL types
    if (urlType === 'tutorials' || lowerTitle.includes('tutorial') || lowerTitle.includes('getting started') || lowerTitle.includes('how to')) {
      return 'tutorials';
    }
    if (urlType === 'videos' || lowerTitle.includes('video') || lowerUrl.includes('youtube') || lowerUrl.includes('vimeo') || lowerUrl.includes('watch')) {
      return 'videos';
    }
    if (urlType === 'training' || lowerTitle.includes('training') || lowerTitle.includes('course') || lowerTitle.includes('webinar') || lowerTitle.includes('workshop')) {
      return 'training';
    }
    if (urlType === 'faq' || lowerTitle.includes('faq') || lowerTitle.includes('question') || lowerTitle.includes('troubleshoot') || lowerTitle.includes('problem')) {
      return 'faqs';
    }
    if (urlType === 'integrations' || lowerTitle.includes('integration') || lowerTitle.includes('connect') || lowerTitle.includes('sync')) {
      return 'integrations';
    }
    
    // Check URL patterns
    if (lowerUrl.includes('/doc') || lowerUrl.includes('/help') || lowerUrl.includes('/support')) {
      return 'documentation';
    }
    if (lowerUrl.includes('/tutorial') || lowerUrl.includes('/guide') || lowerUrl.includes('/quickstart')) {
      return 'tutorials';
    }
    if (lowerUrl.includes('/faq') || lowerUrl.includes('/kb') || lowerUrl.includes('/knowledge')) {
      return 'faqs';
    }
    
    return 'documentation'; // Default
  }

  private categorizeResourceType(title: string, url: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube') || lowerUrl.includes('vimeo') || lowerTitle.includes('video') || lowerUrl.includes('watch')) {
      return 'video';
    }
    if (lowerUrl.includes('.pdf') || lowerTitle.includes('pdf') || lowerTitle.includes('download')) {
      return 'guide';
    }
    if (lowerTitle.includes('tutorial') || lowerTitle.includes('getting started') || lowerTitle.includes('how to') || lowerTitle.includes('quickstart')) {
      return 'tutorial';
    }
    if (lowerTitle.includes('api') || lowerUrl.includes('/api') || lowerTitle.includes('documentation') || lowerTitle.includes('docs') || lowerTitle.includes('reference')) {
      return 'documentation';
    }
    
    return 'other';
  }

  private async generateAIInsights(result: DeepScanResult, toolName: string): Promise<void> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        this.setDefaultInsights(result, toolName);
        return;
      }

      const allResources = Object.values(result.categorizedResources).flat();
      const resourceSummary = allResources
        .slice(0, 15)
        .map(r => `${r.title}: ${r.type}`)
        .join('\n');

      const prompt = `Analyze these ${toolName} resources for teachers:

Resources found:
${resourceSummary}

Provide teacher-focused insights in this exact JSON format:
{
  "toolOverview": "2-3 sentences about how teachers can use ${toolName}",
  "teacherBenefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "commonUseCases": ["Use case 1", "Use case 2", "Use case 3", "Use case 4", "Use case 5"],
  "setupComplexity": "easy",
  "bestFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"]
}

setupComplexity must be exactly one of: easy, medium, or complex`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const insights = JSON.parse(content);
        result.aiInsights = {
          toolOverview: insights.toolOverview || `${toolName} helps teachers enhance their classroom instruction.`,
          teacherBenefits: Array.isArray(insights.teacherBenefits) ? insights.teacherBenefits : [],
          commonUseCases: Array.isArray(insights.commonUseCases) ? insights.commonUseCases : [],
          setupComplexity: ['easy', 'medium', 'complex'].includes(insights.setupComplexity) ? insights.setupComplexity : 'medium',
          bestFeatures: Array.isArray(insights.bestFeatures) ? insights.bestFeatures : []
        };
      } else {
        this.setDefaultInsights(result, toolName);
      }
    } catch (error) {
      console.error('Failed to generate AI insights:', error);
      this.setDefaultInsights(result, toolName);
    }
  }

  private async enhanceResourcesWithAI(result: DeepScanResult, toolName: string): Promise<void> {
    // Skip if no OpenAI key
    if (!process.env.OPENAI_API_KEY) return;

    // Enhance top 3 resources in each category
    for (const [category, resources] of Object.entries(result.categorizedResources)) {
      if (resources.length === 0) continue;
      
      const topResources = resources.slice(0, 3);
      for (const resource of topResources) {
        try {
          const analysis = await this.analyzeResource(resource, toolName);
          resource.aiAnalysis = analysis;
        } catch (error) {
          console.warn(`Failed to analyze resource: ${resource.title}`);
        }
      }
    }
  }

  private async analyzeResource(resource: DeepResource, toolName: string): Promise<any> {
    try {
      const prompt = `Analyze this ${toolName} resource for teachers:
Title: ${resource.title}
Type: ${resource.type}

Provide JSON:
{
  "relevanceScore": 8,
  "teacherValue": "One sentence about value for teachers",
  "quickTips": ["Tip 1", "Tip 2", "Tip 3"]
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      // Return defaults
    }
    
    return {
      relevanceScore: 7,
      teacherValue: `Useful ${resource.type} resource for implementing ${toolName}`,
      quickTips: ['Review before using', 'Share with colleagues', 'Bookmark for reference']
    };
  }

  private setDefaultInsights(result: DeepScanResult, toolName: string): void {
    result.aiInsights = {
      toolOverview: `${toolName} is an educational tool that can enhance teaching and learning.`,
      teacherBenefits: [
        'Saves time on lesson preparation',
        'Increases student engagement',
        'Provides progress tracking',
        'Supports diverse learning styles',
        'Facilitates collaboration'
      ],
      commonUseCases: [
        'Classroom instruction',
        'Homework assignments',
        'Student assessment',
        'Group projects',
        'Remote learning'
      ],
      setupComplexity: 'medium',
      bestFeatures: [
        'User-friendly interface',
        'Educational content',
        'Progress tracking',
        'Collaboration tools',
        'Reporting features'
      ]
    };
  }

  private countResources(resources: EnhancedCategorizedResources): number {
    return Object.values(resources).reduce((total, category) => total + category.length, 0);
  }
}

// Singleton instance
export const playwrightScanner = new PlaywrightScanner();