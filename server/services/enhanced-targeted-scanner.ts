import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import { getJson } from 'serpapi';
import NodeCache from 'node-cache';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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

export class EnhancedTargetedScanner {
  private openai: OpenAI;
  private cache: NodeCache;
  
  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    // Cache for 1 hour for targeted scans
    this.cache = new NodeCache({ stdTTL: 3600 });
    
    console.log('🚀 Enhanced Targeted Scanner initialized');
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

    console.log(`[Enhanced Targeted Scanner] Starting deep scan of ${Object.keys(urls).length} URLs for ${toolName}`);

    // Phase 1: Deep scan each URL with AI analysis
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

    // Phase 4: Extract basic tool information from main page
    if (urls.main && result.categorizedResources.documentation.length > 0) {
      const mainResource = result.categorizedResources.documentation.find(r => r.source === 'main_page');
      if (mainResource) {
        result.name = mainResource.title || toolName;
        result.description = mainResource.description || '';
        result.logo = this.extractLogoFromMainPage(mainResource);
      }
    }

    // Update metadata
    result.metadata.urlsScanned = scanPromises.length;
    result.metadata.resourcesFound = this.countResources(result.categorizedResources);
    result.metadata.aiAnalysisTime = Date.now() - startTime;

    console.log(`[Enhanced Targeted Scanner] Deep scan completed in ${result.metadata.aiAnalysisTime}ms`);
    console.log(`Found ${result.metadata.resourcesFound} resources across ${result.metadata.urlsScanned} URLs`);

    return result;
  }

  private async deepScanSingleUrl(url: string, urlType: keyof TargetedUrls, toolName: string, result: DeepScanResult): Promise<void> {
    try {
      console.log(`[Enhanced Scanner] Deep scanning ${urlType}: ${url}`);
      
      // Use Puppeteer for comprehensive page analysis
      const browser = await this.launchBrowser();
      const page = await browser.newPage();
      
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      
      // Wait for content to load and check for protection pages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract comprehensive page data
      const pageData = await page.evaluate(() => {
        // Check for common protection/redirect pages
        const title = document.title.toLowerCase();
        const bodyText = document.body.textContent?.toLowerCase() || '';
        
        const isProtectionPage = title.includes('just a moment') || 
                               title.includes('cloudflare') || 
                               title.includes('please wait') ||
                               bodyText.includes('checking your browser') ||
                               bodyText.includes('ddos protection');
                               
        if (isProtectionPage) {
          return {
            title: 'Page Protection Detected',
            isProtected: true,
            description: 'This page has protection enabled',
            headings: [],
            links: [],
            paragraphs: [],
            features: [],
            buttons: []
          };
        }

        const extractedData = {
          title: document.title,
          isProtected: false,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent?.trim()).filter(Boolean).slice(0, 10),
          links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
            text: link.textContent?.trim() || '',
            href: link.getAttribute('href') || '',
            title: link.getAttribute('title') || ''
          })).filter(link => link.text && link.href && link.text.length > 2).slice(0, 30),
          paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent?.trim()).filter(Boolean).slice(0, 15),
          features: Array.from(document.querySelectorAll('[class*="feature"], [class*="benefit"], [class*="highlight"]')).map(el => el.textContent?.trim()).filter(Boolean),
          buttons: Array.from(document.querySelectorAll('button, .btn, [class*="button"]')).map(btn => btn.textContent?.trim()).filter(Boolean)
        };
        return extractedData;
      });

      await browser.close();

      // Skip processing if we hit a protection page
      if (pageData.isProtected) {
        console.log(`[Enhanced Scanner] Skipping protected page: ${url}`);
        result.metadata.errors.push(`${urlType}: Page has bot protection enabled`);
        return;
      }

      // AI-powered content analysis
      const aiAnalysis = await this.analyzePageWithAI(pageData, urlType, toolName, url);
      
      // Process and categorize based on URL type and AI analysis
      await this.processPageData(pageData, aiAnalysis, urlType, url, result);
      
    } catch (error) {
      console.error(`[Enhanced Scanner] Error scanning ${urlType} (${url}):`, error.message);
      result.metadata.errors.push(`${urlType} scan failed: ${error.message}`);
    }
  }

  private async analyzePageWithAI(pageData: any, urlType: string, toolName: string, url: string): Promise<any> {
    try {
      // First try AI-powered analysis if OpenAI is available
      if (process.env.OPENAI_API_KEY) {
        try {
          const prompt = `Analyze this ${toolName} ${urlType} page for teachers:

Title: ${pageData.title || 'N/A'}
Description: ${pageData.description || 'N/A'}
Headings: ${(pageData.headings || []).slice(0, 5).join(', ')}
Key content: ${(pageData.paragraphs || []).slice(0, 3).join(' ').substring(0, 500)}

Provide teacher-focused analysis:
1. Top 3 benefits for teachers
2. Setup complexity and instructions
3. Key educational features
4. Available support resources
5. Integration capabilities
6. Relevance score (1-10) for educational use
7. 3 quick implementation tips

Respond with valid JSON only:
{
  "teacherBenefits": ["benefit1", "benefit2", "benefit3"],
  "setupInfo": "setup instructions",
  "keyFeatures": ["feature1", "feature2", "feature3"],
  "supportResources": ["resource1", "resource2"],
  "integrations": ["integration1", "integration2"],
  "relevanceScore": 8,
  "quickTips": ["tip1", "tip2", "tip3"]
}`;

          const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" }
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            try {
              const aiAnalysis = JSON.parse(content);
              // Validate and ensure all fields exist
              return {
                teacherBenefits: aiAnalysis.teacherBenefits || this.extractTeacherBenefits(pageData, urlType),
                setupInfo: aiAnalysis.setupInfo || this.extractSetupInfo(pageData, urlType),
                keyFeatures: aiAnalysis.keyFeatures || this.extractKeyFeatures(pageData),
                supportResources: aiAnalysis.supportResources || this.extractSupportResources(pageData),
                integrations: aiAnalysis.integrations || this.extractIntegrations(pageData),
                relevanceScore: aiAnalysis.relevanceScore || this.calculateRelevanceScore(pageData, urlType),
                quickTips: aiAnalysis.quickTips || this.generateQuickTips(urlType, toolName)
              };
            } catch (parseError) {
              console.warn('Failed to parse AI response, using fallback analysis');
            }
          }
        } catch (aiError) {
          console.warn(`AI analysis error for ${urlType}, using structured fallback:`, aiError.message);
        }
      }

      // Fallback to structured analysis if AI is not available or fails
      const fallbackAnalysis = {
        teacherBenefits: this.extractTeacherBenefits(pageData, urlType),
        setupInfo: this.extractSetupInfo(pageData, urlType),
        keyFeatures: this.extractKeyFeatures(pageData),
        supportResources: this.extractSupportResources(pageData),
        integrations: this.extractIntegrations(pageData),
        relevanceScore: this.calculateRelevanceScore(pageData, urlType),
        quickTips: this.generateQuickTips(urlType, toolName)
      };

      return fallbackAnalysis;
    } catch (error) {
      console.error(`AI analysis failed for ${urlType}:`, error.message);
      return {
        teacherBenefits: [],
        setupInfo: 'Analysis not available',
        keyFeatures: [],
        supportResources: [],
        integrations: [],
        relevanceScore: 5,
        quickTips: []
      };
    }
  }

  private async processPageData(pageData: any, aiAnalysis: any, urlType: keyof TargetedUrls, url: string, result: DeepScanResult): Promise<void> {
    // Always add the main page as a primary resource
    const mainTitle = pageData.title?.trim() || `${urlType.charAt(0).toUpperCase() + urlType.slice(1)} Resource`;
    const mainResource: DeepResource = {
      title: mainTitle,
      url: url,
      description: pageData.description?.substring(0, 200) || aiAnalysis.setupInfo || `Main ${urlType} page with educational resources`,
      type: this.categorizeResourceType(mainTitle, url),
      source: 'main_page',
      verified: true,
      aiAnalysis: {
        relevanceScore: aiAnalysis.relevanceScore,
        teacherValue: aiAnalysis.teacherBenefits?.[0] || 'Educational resource for teachers',
        quickTips: aiAnalysis.quickTips || []
      }
    };

    const mainCategory = this.determineResourceCategory(mainTitle, url, urlType);
    if (result.categorizedResources[mainCategory]) {
      result.categorizedResources[mainCategory].push(mainResource);
    }

    // Process significant links found on the page
    const processedLinks = new Set<string>();
    for (const link of (pageData.links || []).slice(0, 15)) { // Process top 15 meaningful links
      if (!link.href || !link.text) continue;
      
      // Clean and validate the link
      let fullUrl;
      try {
        fullUrl = link.href.startsWith('http') ? link.href : new URL(link.href, url).toString();
      } catch {
        continue; // Skip invalid URLs
      }
      
      // Skip duplicates and same-page links
      if (processedLinks.has(fullUrl) || fullUrl === url) continue;
      processedLinks.add(fullUrl);
      
      // Clean and validate title
      const title = link.text?.trim() || '';
      if (!title || title.length < 5 || title.length > 100) continue;
      
      // Skip common navigation links
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('home') || lowerTitle.includes('contact') || 
          lowerTitle.includes('about') || lowerTitle.includes('login') ||
          lowerTitle.includes('privacy') || lowerTitle.includes('terms')) {
        continue;
      }
      
      const resource: DeepResource = {
        title: title,
        url: fullUrl,
        description: link.title?.substring(0, 200) || aiAnalysis.setupInfo || `${title} - resource from ${urlType}`,
        type: this.categorizeResourceType(title, fullUrl),
        source: urlType,
        verified: true,
        aiAnalysis: {
          relevanceScore: Math.min(aiAnalysis.relevanceScore - 1, 8), // Slightly lower than main page
          teacherValue: aiAnalysis.teacherBenefits?.[0] || 'Supporting educational resource',
          quickTips: aiAnalysis.quickTips || []
        }
      };

      // Categorize into appropriate bucket
      const category = this.determineResourceCategory(title, fullUrl, urlType);
      if (result.categorizedResources[category]) {
        result.categorizedResources[category].push(resource);
      }
    }
  }

  private determineResourceCategory(title: string, url: string, urlType: keyof TargetedUrls): keyof EnhancedCategorizedResources {
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    // Direct mapping for URL types
    if (urlType === 'tutorials') return 'tutorials';
    if (urlType === 'videos') return 'videos';
    if (urlType === 'training') return 'training';
    if (urlType === 'faq') return 'faqs';
    if (urlType === 'integrations') return 'integrations';
    
    // Content-based categorization
    if (lowerTitle.includes('tutorial') || lowerTitle.includes('getting started') || lowerTitle.includes('how to')) {
      return 'tutorials';
    }
    if (lowerTitle.includes('video') || lowerUrl.includes('youtube') || lowerUrl.includes('vimeo')) {
      return 'videos';
    }
    if (lowerTitle.includes('integration') || lowerTitle.includes('microsoft') || lowerTitle.includes('google')) {
      return 'integrations';
    }
    if (lowerTitle.includes('training') || lowerTitle.includes('course') || lowerTitle.includes('webinar')) {
      return 'training';
    }
    if (lowerTitle.includes('faq') || lowerTitle.includes('question') || lowerTitle.includes('troubleshoot')) {
      return 'faqs';
    }
    
    return 'documentation'; // Default
  }

  private categorizeResourceType(title: string, url: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();
    
    // Return only valid enum values: "tutorial" | "documentation" | "video" | "guide" | "other"
    if (lowerUrl.includes('youtube') || lowerUrl.includes('vimeo') || lowerTitle.includes('video')) return 'video';
    if (lowerUrl.includes('.pdf') || lowerTitle.includes('pdf') || lowerTitle.includes('guide')) return 'guide';
    if (lowerTitle.includes('tutorial') || lowerTitle.includes('getting started') || lowerTitle.includes('how to')) return 'tutorial';
    if (lowerTitle.includes('api') || lowerUrl.includes('/api/') || lowerTitle.includes('documentation') || 
        lowerTitle.includes('help') || lowerTitle.includes('support') || lowerTitle.includes('docs')) return 'documentation';
    
    return 'other'; // Default to valid enum value
  }

  private async generateAIInsights(result: DeepScanResult, toolName: string): Promise<void> {
    try {
      // Compile all found content for AI analysis
      const allResources = [
        ...result.categorizedResources.documentation,
        ...result.categorizedResources.tutorials,
        ...result.categorizedResources.training
      ];

      // Limit resource summary to avoid token limits
      const resourceSummary = allResources
        .slice(0, 10)
        .map(r => `${r.title}: ${r.description?.substring(0, 100)}`)
        .join('\n');
      
      const prompt = `Based on this comprehensive scan of ${toolName} resources, provide teacher-focused insights.

Resources found:
${resourceSummary}

Generate educational insights with exactly this JSON structure:
{
  "toolOverview": "A 2-3 sentence overview specifically for teachers about how this tool can enhance their teaching",
  "teacherBenefits": ["Specific benefit 1 for teachers", "Specific benefit 2", "Specific benefit 3", "Specific benefit 4", "Specific benefit 5"],
  "commonUseCases": ["Classroom use case 1", "Classroom use case 2", "Classroom use case 3", "Classroom use case 4", "Classroom use case 5"],
  "setupComplexity": "easy",
  "bestFeatures": ["Educational feature 1", "Educational feature 2", "Educational feature 3", "Educational feature 4", "Educational feature 5"]
}

Note: setupComplexity must be exactly one of: "easy", "medium", or "complex"`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const insights = JSON.parse(content);
          
          // Validate and sanitize the insights
          result.aiInsights = {
            toolOverview: insights.toolOverview || `${toolName} is an educational tool designed to support teachers and enhance student learning.`,
            teacherBenefits: Array.isArray(insights.teacherBenefits) ? insights.teacherBenefits.slice(0, 5) : [
              'Saves time on lesson planning',
              'Enhances student engagement',
              'Provides analytics and insights',
              'Supports differentiated instruction',
              'Easy to integrate with existing curriculum'
            ],
            commonUseCases: Array.isArray(insights.commonUseCases) ? insights.commonUseCases.slice(0, 5) : [
              'Creating interactive lessons',
              'Assessing student understanding',
              'Facilitating group collaboration',
              'Tracking student progress',
              'Sharing resources with students'
            ],
            setupComplexity: ['easy', 'medium', 'complex'].includes(insights.setupComplexity) ? insights.setupComplexity : 'medium',
            bestFeatures: Array.isArray(insights.bestFeatures) ? insights.bestFeatures.slice(0, 5) : [
              'User-friendly interface',
              'Real-time feedback',
              'Customizable content',
              'Cross-platform compatibility',
              'Comprehensive reporting'
            ]
          };
        } catch (parseError) {
          console.warn('Failed to parse AI insights, using defaults');
          this.setDefaultInsights(result, toolName);
        }
      } else {
        this.setDefaultInsights(result, toolName);
      }
    } catch (error) {
      console.error('Failed to generate AI insights:', error.message);
      this.setDefaultInsights(result, toolName);
    }
  }

  private setDefaultInsights(result: DeepScanResult, toolName: string): void {
    result.aiInsights = {
      toolOverview: `${toolName} is an educational technology tool that can help teachers enhance their classroom instruction and student engagement.`,
      teacherBenefits: [
        'Streamlines lesson planning and preparation',
        'Provides tools for student assessment',
        'Facilitates classroom collaboration',
        'Offers progress tracking capabilities',
        'Supports diverse learning styles'
      ],
      commonUseCases: [
        'Daily classroom instruction',
        'Homework and assignments',
        'Student assessment and grading',
        'Parent-teacher communication',
        'Professional development'
      ],
      setupComplexity: 'medium' as const,
      bestFeatures: [
        'Intuitive user interface',
        'Educational content library',
        'Student progress tracking',
        'Collaboration tools',
        'Reporting and analytics'
      ]
    };
  }

  private async enhanceResourcesWithAI(result: DeepScanResult, toolName: string): Promise<void> {
    // For each category, enhance top resources with detailed AI analysis
    for (const [category, resources] of Object.entries(result.categorizedResources)) {
      if (resources.length === 0) continue;
      
      // Enhance top 3 resources in each category
      const topResources = resources.slice(0, 3);
      
      for (const resource of topResources) {
        try {
          if (!resource.aiAnalysis) {
            resource.aiAnalysis = await this.generateResourceAnalysis(resource, toolName);
          }
        } catch (error) {
          console.error(`Failed to enhance resource ${resource.title}:`, error.message);
        }
      }
    }
  }

  private async generateResourceAnalysis(resource: DeepResource, toolName: string): Promise<any> {
    try {
      const prompt = `Analyze this ${toolName} resource for teachers:

Title: ${resource.title}
URL: ${resource.url}
Description: ${resource.description || 'N/A'}
Type: ${resource.type}

Provide a teacher-focused analysis with this exact JSON structure:
{
  "relevanceScore": 8,
  "teacherValue": "One sentence explaining why this specific resource is valuable for teachers",
  "quickTips": ["Practical tip 1 for using this resource", "Practical tip 2", "Practical tip 3"]
}

The relevanceScore should be a number from 1-10.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const analysis = JSON.parse(content);
          return {
            relevanceScore: typeof analysis.relevanceScore === 'number' ? 
              Math.min(10, Math.max(1, analysis.relevanceScore)) : 7,
            teacherValue: analysis.teacherValue || `This ${resource.type} provides valuable support for ${toolName} implementation in the classroom.`,
            quickTips: Array.isArray(analysis.quickTips) ? 
              analysis.quickTips.slice(0, 3) : 
              [
                'Review this resource before class to prepare',
                'Share relevant sections with students as needed',
                'Use as a reference during implementation'
              ]
          };
        } catch (parseError) {
          console.warn('Failed to parse resource analysis, using defaults');
        }
      }
    } catch (error) {
      console.warn(`Resource analysis failed for ${resource.title}:`, error.message);
    }
    
    // Return defaults if AI analysis fails
    return {
      relevanceScore: 7,
      teacherValue: `This ${resource.type} resource helps teachers effectively use ${toolName} in their classroom.`,
      quickTips: [
        'Bookmark this resource for quick reference',
        'Review before implementing in class',
        'Share with colleagues who use ' + toolName
      ]
    };
  }

  private async launchBrowser() {
    const executablePath = await this.resolveExecPath();
    
    return await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 15000
    });
  }

  private async resolveExecPath(): Promise<string | undefined> {
    try {
      const { stdout } = await promisify(exec)('which chromium');
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private countResources(resources: EnhancedCategorizedResources): number {
    return Object.values(resources).reduce((total, category) => total + category.length, 0);
  }

  // Helper methods for structured page analysis
  private extractTeacherBenefits(pageData: any, urlType: string): string[] {
    const benefits = [];
    const lowerDesc = (pageData.description || '').toLowerCase();
    const headings = (pageData.headings || []).join(' ').toLowerCase();
    
    if (lowerDesc.includes('classroom') || headings.includes('classroom')) {
      benefits.push('Classroom-ready features');
    }
    if (lowerDesc.includes('student') || headings.includes('student')) {
      benefits.push('Student engagement tools');
    }
    if (lowerDesc.includes('curriculum') || headings.includes('curriculum')) {
      benefits.push('Curriculum integration support');
    }
    if (urlType === 'training') {
      benefits.push('Professional development resources');
    }
    if (urlType === 'tutorials') {
      benefits.push('Step-by-step guidance for teachers');
    }
    
    return benefits.length > 0 ? benefits : ['Educational resource for teachers'];
  }

  private extractSetupInfo(pageData: any, urlType: string): string {
    const title = pageData.title || '';
    if (urlType === 'tutorials') {
      return `Tutorial guide: ${title}`;
    }
    if (urlType === 'videos') {
      return `Video resource: ${title}`;
    }
    if (urlType === 'training') {
      return `Training material: ${title}`;
    }
    return pageData.description?.substring(0, 100) || `${urlType} resource from this tool`;
  }

  private extractKeyFeatures(pageData: any): string[] {
    const features = [];
    const allText = [pageData.title, pageData.description, ...(pageData.headings || [])].join(' ').toLowerCase();
    
    if (allText.includes('integration')) features.push('Third-party integrations');
    if (allText.includes('collaboration')) features.push('Collaboration tools');
    if (allText.includes('assessment')) features.push('Assessment capabilities');
    if (allText.includes('analytics')) features.push('Analytics and reporting');
    if (allText.includes('mobile')) features.push('Mobile accessibility');
    
    return features.length > 0 ? features : ['Core educational features'];
  }

  private extractSupportResources(pageData: any): string[] {
    const resources = [];
    const links = pageData.links || [];
    
    links.forEach((link: any) => {
      const linkText = link.text?.toLowerCase() || '';
      if (linkText.includes('help')) resources.push('Help documentation');
      if (linkText.includes('support')) resources.push('Customer support');
      if (linkText.includes('tutorial')) resources.push('Tutorial guides');
      if (linkText.includes('faq')) resources.push('FAQ resources');
    });
    
    return resources.length > 0 ? [...new Set(resources)] : ['Documentation and support'];
  }

  private extractIntegrations(pageData: any): string[] {
    const integrations = [];
    const allText = [pageData.title, pageData.description, ...(pageData.headings || [])].join(' ').toLowerCase();
    
    if (allText.includes('microsoft') || allText.includes('teams')) integrations.push('Microsoft Teams');
    if (allText.includes('google')) integrations.push('Google Workspace');
    if (allText.includes('canvas')) integrations.push('Canvas LMS');
    if (allText.includes('moodle')) integrations.push('Moodle');
    if (allText.includes('blackboard')) integrations.push('Blackboard');
    
    return integrations.length > 0 ? integrations : ['Standard integrations available'];
  }

  private calculateRelevanceScore(pageData: any, urlType: string): number {
    let score = 5; // Base score
    
    const allText = [pageData.title, pageData.description, ...(pageData.headings || [])].join(' ').toLowerCase();
    
    // Higher scores for education-related content
    if (allText.includes('education') || allText.includes('teacher') || allText.includes('student')) score += 2;
    if (allText.includes('classroom') || allText.includes('school')) score += 1;
    if (urlType === 'tutorials' || urlType === 'training') score += 1;
    if (pageData.links && pageData.links.length > 5) score += 1; // Rich content
    
    return Math.min(score, 10);
  }

  private generateQuickTips(urlType: string, toolName: string): string[] {
    const tips = [];
    
    if (urlType === 'tutorials') {
      tips.push(`Follow ${toolName} tutorials step-by-step`);
      tips.push('Practice with sample content first');
    } else if (urlType === 'videos') {
      tips.push('Watch instructional videos before implementation');
      tips.push('Take notes on key features demonstrated');
    } else if (urlType === 'training') {
      tips.push('Complete professional development modules');
      tips.push('Apply training concepts in your classroom');
    } else {
      tips.push(`Explore ${toolName} documentation thoroughly`);
      tips.push('Start with basic features before advanced ones');
    }
    
    return tips;
  }

  private extractLogoFromMainPage(resource: DeepResource): string {
    // Try to extract logo URL from the main page resource
    // For now, return empty string - could be enhanced to actually extract logo
    return '';
  }
}