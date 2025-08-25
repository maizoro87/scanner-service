import { chromium } from 'playwright';
import { BrowserError } from '../types/index.js';
class PlaywrightController {
    constructor() {
        this.state = {
            browser: null,
            context: null,
            page: null,
            debug: false
        };
        this.currentMousePosition = { x: 0, y: 0 };
    }
    log(...args) {
        if (this.state.debug) {
            console.log(JSON.stringify({
                type: "debug",
                message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
            }));
        }
    }
    async openBrowser(headless = false, debug = false) {
        try {
            this.state.debug = debug;
            this.log('Attempting to launch browser');
            if (this.state.browser?.isConnected()) {
                this.log('Browser already running');
                return;
            }
            this.log('Launching new browser instance', { headless });
            this.state.browser = await chromium.launch({
                headless,
                args: ['--no-sandbox']
            });
            this.log('Creating browser context');
            this.state.context = await this.state.browser.newContext({
                viewport: { width: 1280, height: 720 }
            });
            this.log('Creating new page');
            this.state.page = await this.state.context.newPage();
            this.log('Browser successfully launched');
        }
        catch (error) {
            console.error('Browser launch error:', error);
            throw new BrowserError('Failed to launch browser', `Technical details: ${error?.message || 'Unknown error'}`);
        }
    }
    async closeBrowser() {
        try {
            this.log('Closing browser');
            await this.state.page?.close();
            await this.state.context?.close();
            await this.state.browser?.close();
            this.state = { browser: null, context: null, page: null, debug: false };
            this.log('Browser closed');
        }
        catch (error) {
            console.error('Browser close error:', error);
            throw new BrowserError('Failed to close browser', 'The browser might have already been closed');
        }
    }
    async navigate(url) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Navigating to', url);
            await this.state.page?.goto(url);
            this.log('Navigation complete');
        }
        catch (error) {
            console.error('Navigation error:', error);
            throw new BrowserError('Failed to navigate', 'Check if the URL is valid and accessible');
        }
    }
    async goBack() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Going back');
            await this.state.page?.goBack();
            this.log('Navigation back complete');
        }
        catch (error) {
            console.error('Go back error:', error);
            throw new BrowserError('Failed to go back', 'Check if there is a previous page in history');
        }
    }
    async refresh() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Refreshing page');
            await this.state.page?.reload();
            this.log('Page refresh complete');
        }
        catch (error) {
            console.error('Refresh error:', error);
            throw new BrowserError('Failed to refresh page', 'Check if the page is still accessible');
        }
    }
    async click(selector) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            if (selector) {
                this.log('Clicking element', selector);
                await this.state.page.click(selector);
            }
            else {
                this.log('Clicking at position', this.currentMousePosition);
                await this.state.page.mouse.click(this.currentMousePosition.x, this.currentMousePosition.y);
            }
            this.log('Click complete');
        }
        catch (error) {
            console.error('Click error:', error);
            throw new BrowserError('Failed to click', selector ? 'Check if the element exists and is visible' : 'Check if mouse position is valid');
        }
    }
    async type(selector, text) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Typing into element', { selector, text });
            await this.state.page?.type(selector, text);
            this.log('Type complete');
        }
        catch (error) {
            console.error('Type error:', error);
            throw new BrowserError('Failed to type text', 'Check if the input element exists and is editable');
        }
    }
    async moveMouse(x, y) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Moving mouse to', { x, y });
            await this.state.page?.mouse.move(x, y);
            this.currentMousePosition = { x, y };
            this.log('Mouse move complete');
        }
        catch (error) {
            console.error('Mouse move error:', error);
            throw new BrowserError('Failed to move mouse', 'Check if coordinates are within viewport');
        }
    }
    async scroll(x, y, smooth = false) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Scrolling', { x, y, smooth });
            // Get scroll position before scrolling
            const beforeScroll = await this.state.page.evaluate(() => ({
                x: window.scrollX,
                y: window.scrollY
            }));
            // Perform scroll with optional smooth behavior
            await this.state.page.evaluate((args) => {
                window.scrollBy({
                    left: args.x,
                    top: args.y,
                    behavior: args.smooth ? 'smooth' : 'auto'
                });
            }, { x, y, smooth });
            // Wait for scroll to complete
            await this.state.page.waitForTimeout(smooth ? 500 : 100);
            // Get scroll position after scrolling
            const afterScroll = await this.state.page.evaluate(() => ({
                x: window.scrollX,
                y: window.scrollY
            }));
            this.log('Scroll complete', { before: beforeScroll, after: afterScroll });
            return {
                before: beforeScroll,
                after: afterScroll
            };
        }
        catch (error) {
            console.error('Scroll error:', error);
            throw new BrowserError('Failed to scroll', 'Check if scroll values are valid');
        }
    }
    async screenshot(options) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Taking screenshot', options);
            if (options.type === 'element' && options.selector) {
                const element = await this.state.page.$(options.selector);
                if (!element) {
                    throw new Error('Element not found');
                }
                await element.screenshot({ path: options.path });
            }
            else if (options.type === 'viewport') {
                await this.state.page.screenshot({ path: options.path });
            }
            else {
                await this.state.page.screenshot({ path: options.path, fullPage: true });
            }
            this.log('Screenshot saved to', options.path);
        }
        catch (error) {
            console.error('Screenshot error:', error);
            throw new BrowserError('Failed to take screenshot', 'Check if the path is writable and element exists (if capturing element)');
        }
    }
    async inspectElement(selector) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Inspecting element', selector);
            const info = await this.state.page.$eval(selector, (el) => ({
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                attributes: Array.from(el.attributes).map(attr => ({
                    name: attr.name,
                    value: attr.value
                })),
                innerText: el.textContent
            }));
            this.log('Element inspection complete');
            return info;
        }
        catch (error) {
            console.error('Inspect element error:', error);
            throw new BrowserError('Failed to inspect element', 'Check if the element exists');
        }
    }
    async getPageSource() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page source');
            const content = await this.state.page?.content();
            this.log('Page source retrieved');
            return content || '';
        }
        catch (error) {
            console.error('Get page source error:', error);
            throw new BrowserError('Failed to get page source', 'Check if the page is loaded');
        }
    }
    async getPageText() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page text content');
            const text = await this.state.page?.innerText('body');
            this.log('Page text retrieved');
            return text || '';
        }
        catch (error) {
            console.error('Get page text error:', error);
            throw new BrowserError('Failed to get page text', 'Check if the page is loaded');
        }
    }
    async getPageTitle() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page title');
            const title = await this.state.page?.title();
            this.log('Page title retrieved:', title);
            return title || '';
        }
        catch (error) {
            console.error('Get page title error:', error);
            throw new BrowserError('Failed to get page title', 'Check if the page is loaded');
        }
    }
    async getPageUrl() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page URL');
            const url = this.state.page?.url();
            this.log('Page URL retrieved:', url);
            return url || '';
        }
        catch (error) {
            console.error('Get page URL error:', error);
            throw new BrowserError('Failed to get page URL', 'Check if the page is loaded');
        }
    }
    async getScripts() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page scripts');
            const scripts = await this.state.page?.evaluate(() => {
                const scriptElements = Array.from(document.querySelectorAll('script'));
                return scriptElements.map(script => {
                    if (script.src) {
                        return `// External script: ${script.src}`;
                    }
                    return script.textContent || script.innerHTML;
                }).filter(content => content.trim().length > 0);
            });
            this.log('Scripts retrieved:', scripts?.length);
            return scripts || [];
        }
        catch (error) {
            console.error('Get scripts error:', error);
            throw new BrowserError('Failed to get scripts', 'Check if the page is loaded');
        }
    }
    async getStylesheets() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page stylesheets');
            const stylesheets = await this.state.page?.evaluate(() => {
                const styleElements = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
                return styleElements.map(element => {
                    if (element.tagName === 'LINK') {
                        const link = element;
                        return `/* External stylesheet: ${link.href} */`;
                    }
                    return element.textContent || element.innerHTML;
                }).filter(content => content.trim().length > 0);
            });
            this.log('Stylesheets retrieved:', stylesheets?.length);
            return stylesheets || [];
        }
        catch (error) {
            console.error('Get stylesheets error:', error);
            throw new BrowserError('Failed to get stylesheets', 'Check if the page is loaded');
        }
    }
    async getMetaTags() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting meta tags');
            const metaTags = await this.state.page?.evaluate(() => {
                const metaElements = Array.from(document.querySelectorAll('meta'));
                return metaElements.map(meta => ({
                    name: meta.getAttribute('name') || undefined,
                    property: meta.getAttribute('property') || undefined,
                    content: meta.getAttribute('content') || undefined,
                    httpEquiv: meta.getAttribute('http-equiv') || undefined
                }));
            });
            this.log('Meta tags retrieved:', metaTags?.length);
            return metaTags || [];
        }
        catch (error) {
            console.error('Get meta tags error:', error);
            throw new BrowserError('Failed to get meta tags', 'Check if the page is loaded');
        }
    }
    async getLinks() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page links');
            const links = await this.state.page?.evaluate(() => {
                const linkElements = Array.from(document.querySelectorAll('a[href]'));
                return linkElements.map(link => ({
                    href: link.href,
                    text: link.textContent?.trim() || '',
                    title: link.getAttribute('title') || undefined
                }));
            });
            this.log('Links retrieved:', links?.length);
            return links || [];
        }
        catch (error) {
            console.error('Get links error:', error);
            throw new BrowserError('Failed to get links', 'Check if the page is loaded');
        }
    }
    async getImages() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page images');
            const images = await this.state.page?.evaluate(() => {
                const imgElements = Array.from(document.querySelectorAll('img'));
                return imgElements.map(img => ({
                    src: img.src,
                    alt: img.getAttribute('alt') || undefined,
                    title: img.getAttribute('title') || undefined,
                    width: img.naturalWidth || undefined,
                    height: img.naturalHeight || undefined
                }));
            });
            this.log('Images retrieved:', images?.length);
            return images || [];
        }
        catch (error) {
            console.error('Get images error:', error);
            throw new BrowserError('Failed to get images', 'Check if the page is loaded');
        }
    }
    async getForms() {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting page forms');
            const forms = await this.state.page?.evaluate(() => {
                const formElements = Array.from(document.querySelectorAll('form'));
                return formElements.map(form => ({
                    action: form.getAttribute('action') || undefined,
                    method: form.getAttribute('method') || undefined,
                    fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
                        name: field.getAttribute('name') || undefined,
                        type: field.getAttribute('type') || field.tagName.toLowerCase(),
                        value: field.value || undefined
                    }))
                }));
            });
            this.log('Forms retrieved:', forms?.length);
            return forms || [];
        }
        catch (error) {
            console.error('Get forms error:', error);
            throw new BrowserError('Failed to get forms', 'Check if the page is loaded');
        }
    }
    async getElementContent(selector) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting element content for selector:', selector);
            const content = await this.state.page?.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element) {
                    throw new Error(`Element not found: ${sel}`);
                }
                return {
                    html: element.innerHTML,
                    text: element.textContent || ''
                };
            }, selector);
            this.log('Element content retrieved');
            return content || { html: '', text: '' };
        }
        catch (error) {
            console.error('Get element content error:', error);
            throw new BrowserError('Failed to get element content', 'Check if the element exists');
        }
    }
    async executeJavaScript(script) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Executing JavaScript:', script);
            const result = await this.state.page?.evaluate((scriptToExecute) => {
                // Create a function wrapper to handle different types of JavaScript code
                try {
                    // If the script is an expression, return its value
                    // If the script is statements, execute them and return undefined
                    const wrappedScript = `
            (function() {
              ${scriptToExecute}
            })()
          `;
                    return eval(wrappedScript);
                }
                catch (error) {
                    // If wrapping fails, try executing directly
                    return eval(scriptToExecute);
                }
            }, script);
            this.log('JavaScript execution completed:', result);
            return result;
        }
        catch (error) {
            console.error('Execute JavaScript error:', error);
            throw new BrowserError('Failed to execute JavaScript', 'Check if the JavaScript syntax is valid');
        }
    }
    async getElementHierarchy(selector = 'body', maxDepth = 3, includeText = false, includeAttributes = false) {
        try {
            if (!this.isInitialized()) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting element hierarchy', { selector, maxDepth, includeText, includeAttributes });
            const hierarchy = await this.state.page?.evaluate((args) => {
                const { selector, maxDepth, includeText, includeAttributes } = args;
                function getElementInfo(element) {
                    const info = {
                        tagName: element.tagName.toLowerCase(),
                        id: element.id || undefined,
                        className: element.className || undefined,
                        children: []
                    };
                    if (includeText && element.textContent) {
                        // Get only direct text content, not from children
                        const directText = Array.from(element.childNodes)
                            .filter(node => node.nodeType === Node.TEXT_NODE)
                            .map(node => node.textContent?.trim())
                            .filter(text => text)
                            .join(' ');
                        if (directText) {
                            info.text = directText;
                        }
                    }
                    if (includeAttributes && element.attributes.length > 0) {
                        info.attributes = {};
                        for (let i = 0; i < element.attributes.length; i++) {
                            const attr = element.attributes[i];
                            if (attr.name !== 'id' && attr.name !== 'class') {
                                info.attributes[attr.name] = attr.value;
                            }
                        }
                    }
                    return info;
                }
                function traverseElement(element, currentDepth) {
                    const elementInfo = getElementInfo(element);
                    if (currentDepth < maxDepth || maxDepth === -1) {
                        const children = Array.from(element.children);
                        elementInfo.children = children.map(child => traverseElement(child, currentDepth + 1));
                    }
                    else if (element.children.length > 0) {
                        elementInfo.childrenCount = element.children.length;
                    }
                    return elementInfo;
                }
                const rootElement = document.querySelector(selector);
                if (!rootElement) {
                    throw new Error(`Element not found: ${selector}`);
                }
                return traverseElement(rootElement, 0);
            }, { selector, maxDepth, includeText, includeAttributes });
            this.log('Element hierarchy retrieved');
            return hierarchy;
        }
        catch (error) {
            console.error('Get element hierarchy error:', error);
            throw new BrowserError('Failed to get element hierarchy', 'Check if the selector exists');
        }
    }
    // Additional navigation methods
    async goForward() {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Going forward');
            await this.state.page.goForward();
            this.log('Forward navigation complete');
        }
        catch (error) {
            console.error('Go forward error:', error);
            throw new BrowserError('Failed to go forward', 'Check if there is a next page in history');
        }
    }
    // Enhanced interaction methods
    async hover(selector) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Hovering over element', { selector });
            const locator = this.state.page.locator(selector);
            await locator.hover();
            this.log('Hover complete');
        }
        catch (error) {
            console.error('Hover error:', error);
            throw new BrowserError('Failed to hover over element', 'Check if the selector exists and is visible');
        }
    }
    async dragAndDrop(sourceSelector, targetSelector) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Performing drag and drop', { sourceSelector, targetSelector });
            const sourceLocator = this.state.page.locator(sourceSelector);
            const targetLocator = this.state.page.locator(targetSelector);
            await sourceLocator.dragTo(targetLocator);
            this.log('Drag and drop complete');
        }
        catch (error) {
            console.error('Drag and drop error:', error);
            throw new BrowserError('Failed to drag and drop', 'Check if both selectors exist and are interactable');
        }
    }
    async selectOption(selector, values) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Selecting options', { selector, values });
            const locator = this.state.page.locator(selector);
            await locator.selectOption(values);
            this.log('Select option complete');
        }
        catch (error) {
            console.error('Select option error:', error);
            throw new BrowserError('Failed to select option', 'Check if the selector exists and values are valid');
        }
    }
    async pressKey(key) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Pressing key', { key });
            await this.state.page.keyboard.press(key);
            this.log('Key press complete');
        }
        catch (error) {
            console.error('Press key error:', error);
            throw new BrowserError('Failed to press key', 'Check if the key name is valid');
        }
    }
    async waitForText(text, timeout = 30000) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Waiting for text', { text, timeout });
            await this.state.page.waitForSelector(`text=${text}`, { timeout });
            this.log('Text found');
        }
        catch (error) {
            console.error('Wait for text error:', error);
            throw new BrowserError('Text not found within timeout', 'Check if the text appears on the page');
        }
    }
    async waitForSelector(selector, timeout = 30000) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Waiting for selector', { selector, timeout });
            await this.state.page.waitForSelector(selector, { timeout });
            this.log('Selector found');
        }
        catch (error) {
            console.error('Wait for selector error:', error);
            throw new BrowserError('Selector not found within timeout', 'Check if the selector appears on the page');
        }
    }
    async resize(width, height) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Resizing viewport', { width, height });
            await this.state.page.setViewportSize({ width, height });
            this.log('Resize complete');
        }
        catch (error) {
            console.error('Resize error:', error);
            throw new BrowserError('Failed to resize viewport', 'Check if width and height are positive numbers');
        }
    }
    // Dialog handling
    async handleDialog(accept, promptText) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Setting up dialog handler', { accept, promptText });
            this.state.page.once('dialog', async (dialog) => {
                this.log('Dialog detected', { type: dialog.type(), message: dialog.message() });
                if (accept) {
                    await dialog.accept(promptText);
                }
                else {
                    await dialog.dismiss();
                }
                this.log('Dialog handled');
            });
        }
        catch (error) {
            console.error('Handle dialog error:', error);
            throw new BrowserError('Failed to handle dialog', 'Check if there is a dialog to handle');
        }
    }
    // Console and network methods
    async getConsoleMessages() {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting console messages');
            const messages = [];
            // Listen to console events
            this.state.page.on('console', msg => {
                messages.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
            });
            // Return collected messages
            this.log('Console messages retrieved');
            return messages;
        }
        catch (error) {
            console.error('Get console messages error:', error);
            throw new BrowserError('Failed to get console messages', 'Browser console monitoring error');
        }
    }
    async getNetworkRequests() {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Getting network requests');
            const requests = [];
            // Listen to request events
            this.state.page.on('request', request => {
                requests.push({
                    url: request.url(),
                    method: request.method()
                });
            });
            this.state.page.on('response', response => {
                const request = requests.find(req => req.url === response.url());
                if (request) {
                    request.status = response.status();
                }
            });
            this.log('Network requests retrieved');
            return requests;
        }
        catch (error) {
            console.error('Get network requests error:', error);
            throw new BrowserError('Failed to get network requests', 'Network monitoring error');
        }
    }
    async uploadFiles(selector, filePaths) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Uploading files', { selector, filePaths });
            const locator = this.state.page.locator(selector);
            await locator.setInputFiles(filePaths);
            this.log('File upload complete');
        }
        catch (error) {
            console.error('File upload error:', error);
            throw new BrowserError('Failed to upload files', 'Check if selector is a file input and files exist');
        }
    }
    async evaluateWithReturn(script) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Evaluating JavaScript with return', { script });
            const result = await this.state.page.evaluate(script);
            this.log('JavaScript evaluation complete');
            return result;
        }
        catch (error) {
            console.error('JavaScript evaluation error:', error);
            throw new BrowserError('Failed to evaluate JavaScript', 'Check if the script is valid JavaScript');
        }
    }
    // Enhanced screenshot functionality
    async takeScreenshot(path, options) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Taking screenshot', { path, options });
            if (options?.element) {
                const locator = this.state.page.locator(options.element);
                await locator.screenshot({ path });
            }
            else {
                await this.state.page.screenshot({ path, fullPage: options?.fullPage });
            }
            this.log('Screenshot saved');
        }
        catch (error) {
            console.error('Screenshot error:', error);
            throw new BrowserError('Failed to take screenshot', 'Check if the path is writable');
        }
    }
    // Mouse coordinate methods
    async mouseMove(x, y) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Moving mouse', { x, y });
            await this.state.page.mouse.move(x, y);
            this.currentMousePosition = { x, y };
            this.log('Mouse move complete');
        }
        catch (error) {
            console.error('Mouse move error:', error);
            throw new BrowserError('Failed to move mouse', 'Check if coordinates are valid');
        }
    }
    async mouseClick(x, y) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Clicking at coordinates', { x, y });
            await this.state.page.mouse.click(x, y);
            this.currentMousePosition = { x, y };
            this.log('Mouse click complete');
        }
        catch (error) {
            console.error('Mouse click error:', error);
            throw new BrowserError('Failed to click at coordinates', 'Check if coordinates are valid');
        }
    }
    async mouseDrag(startX, startY, endX, endY) {
        try {
            if (!this.isInitialized() || !this.state.page) {
                throw new Error('Browser not initialized');
            }
            this.log('Mouse drag', { startX, startY, endX, endY });
            await this.state.page.mouse.move(startX, startY);
            await this.state.page.mouse.down();
            await this.state.page.mouse.move(endX, endY);
            await this.state.page.mouse.up();
            this.currentMousePosition = { x: endX, y: endY };
            this.log('Mouse drag complete');
        }
        catch (error) {
            console.error('Mouse drag error:', error);
            throw new BrowserError('Failed to drag mouse', 'Check if coordinates are valid');
        }
    }
    isInitialized() {
        return !!(this.state.browser?.isConnected() && this.state.context && this.state.page);
    }
}
export const playwrightController = new PlaywrightController();
//# sourceMappingURL=playwright.js.map