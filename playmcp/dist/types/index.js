export class BrowserError extends Error {
    constructor(message, suggestion) {
        super(message);
        this.name = 'BrowserError';
        this.suggestion = suggestion;
    }
}
//# sourceMappingURL=index.js.map