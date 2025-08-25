export class Server {
    constructor(config, capabilities) {
        this.config = config;
        this.capabilities = capabilities;
    }
    setRequestHandler(type, handler) {
        if (type === 'listTools') {
            this.listToolsHandler = handler;
        }
        else {
            this.callToolHandler = handler;
        }
    }
    async handleInput(input) {
        try {
            const message = JSON.parse(input);
            // Handle MCP initialize request
            if (message.method === 'initialize') {
                console.log(JSON.stringify({
                    jsonrpc: "2.0",
                    id: message.id, result: {
                        protocolVersion: "2024-11-05",
                        capabilities: this.capabilities.capabilities,
                        serverInfo: {
                            name: this.config.name,
                            version: this.config.version
                        }
                    }
                }));
                return;
            }
            // Handle MCP notifications/initialized
            if (message.method === 'notifications/initialized') {
                // Acknowledge initialization complete
                return;
            }
            // Handle MCP tools/list request
            if (message.method === 'tools/list') {
                if (!this.listToolsHandler) {
                    throw new Error('No list tools handler registered');
                }
                const response = await this.listToolsHandler();
                console.log(JSON.stringify({
                    jsonrpc: "2.0",
                    id: message.id,
                    result: response
                }));
                return;
            }
            // Handle MCP tools/call request
            if (message.method === 'tools/call') {
                if (!this.callToolHandler) {
                    throw new Error('No call tool handler registered');
                }
                const response = await this.callToolHandler({
                    params: {
                        name: message.params.name,
                        arguments: message.params.arguments
                    }
                });
                console.log(JSON.stringify({
                    jsonrpc: "2.0",
                    id: message.id,
                    result: response
                }));
                return;
            }
            // Legacy command handling (keep for backward compatibility)
            if (message.command) {
                if (!this.callToolHandler) {
                    throw new Error('No call tool handler registered');
                }
                const response = await this.callToolHandler({
                    params: {
                        name: message.command,
                        arguments: message.arguments
                    }
                });
                console.log(JSON.stringify({
                    type: "response",
                    result: {
                        success: !response.isError,
                        ...(response.isError ? {
                            error: {
                                message: response.content[0].text,
                                suggestion: response.content[1]?.text
                            }
                        } : {
                            message: response.content[0].text
                        })
                    }
                }));
            }
        }
        catch (error) {
            console.log(JSON.stringify({
                jsonrpc: "2.0",
                id: input.includes('"id"') ? JSON.parse(input).id : null,
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    data: {
                        suggestion: 'Check input format'
                    }
                }
            }));
        }
    }
    async connect() {
        // Set up stdin handling - wait for initialize request
        process.stdin.setEncoding('utf8');
        let buffer = '';
        process.stdin.on('data', (chunk) => {
            buffer += chunk;
            if (buffer.includes('\n')) {
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleInput(line);
                    }
                }
            }
        });
        return new Promise((resolve) => {
            process.on('SIGINT', () => {
                resolve(undefined);
            });
        });
    }
}
//# sourceMappingURL=server.js.map