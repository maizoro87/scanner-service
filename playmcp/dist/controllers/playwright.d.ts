import { ScreenshotOptions, ElementInfo } from '../types/index.js';
declare class PlaywrightController {
    private state;
    private currentMousePosition;
    private log;
    openBrowser(headless?: boolean, debug?: boolean): Promise<void>;
    closeBrowser(): Promise<void>;
    navigate(url: string): Promise<void>;
    goBack(): Promise<void>;
    refresh(): Promise<void>;
    click(selector?: string): Promise<void>;
    type(selector: string, text: string): Promise<void>;
    moveMouse(x: number, y: number): Promise<void>;
    scroll(x: number, y: number, smooth?: boolean): Promise<{
        before: {
            x: number;
            y: number;
        };
        after: {
            x: number;
            y: number;
        };
    }>;
    screenshot(options: ScreenshotOptions): Promise<void>;
    inspectElement(selector: string): Promise<ElementInfo>;
    getPageSource(): Promise<string>;
    getPageText(): Promise<string>;
    getPageTitle(): Promise<string>;
    getPageUrl(): Promise<string>;
    getScripts(): Promise<string[]>;
    getStylesheets(): Promise<string[]>;
    getMetaTags(): Promise<Array<{
        name?: string;
        property?: string;
        content?: string;
        httpEquiv?: string;
    }>>;
    getLinks(): Promise<Array<{
        href: string;
        text: string;
        title?: string;
    }>>;
    getImages(): Promise<Array<{
        src: string;
        alt?: string;
        title?: string;
        width?: number;
        height?: number;
    }>>;
    getForms(): Promise<Array<{
        action?: string;
        method?: string;
        fields: Array<{
            name?: string;
            type?: string;
            value?: string;
        }>;
    }>>;
    getElementContent(selector: string): Promise<{
        html: string;
        text: string;
    }>;
    executeJavaScript(script: string): Promise<any>;
    getElementHierarchy(selector?: string, maxDepth?: number, includeText?: boolean, includeAttributes?: boolean): Promise<any>;
    goForward(): Promise<void>;
    hover(selector: string): Promise<void>;
    dragAndDrop(sourceSelector: string, targetSelector: string): Promise<void>;
    selectOption(selector: string, values: string[]): Promise<void>;
    pressKey(key: string): Promise<void>;
    waitForText(text: string, timeout?: number): Promise<void>;
    waitForSelector(selector: string, timeout?: number): Promise<void>;
    resize(width: number, height: number): Promise<void>;
    handleDialog(accept: boolean, promptText?: string): Promise<void>;
    getConsoleMessages(): Promise<string[]>;
    getNetworkRequests(): Promise<Array<{
        url: string;
        method: string;
        status?: number;
    }>>;
    uploadFiles(selector: string, filePaths: string[]): Promise<void>;
    evaluateWithReturn(script: string): Promise<any>;
    takeScreenshot(path: string, options?: {
        fullPage?: boolean;
        element?: string;
    }): Promise<void>;
    mouseMove(x: number, y: number): Promise<void>;
    mouseClick(x: number, y: number): Promise<void>;
    mouseDrag(startX: number, startY: number, endX: number, endY: number): Promise<void>;
    isInitialized(): boolean;
}
export declare const playwrightController: PlaywrightController;
export {};
