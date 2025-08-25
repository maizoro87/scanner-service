import { ServerConfig, ServerCapabilities, CallToolRequest, ToolResponse, ListToolsResponse } from './types.js';
export declare class Server {
    private config;
    private capabilities;
    private listToolsHandler?;
    private callToolHandler?;
    constructor(config: ServerConfig, capabilities: ServerCapabilities);
    setRequestHandler<T extends 'listTools' | 'callTool'>(type: T, handler: T extends 'listTools' ? () => Promise<ListToolsResponse> : (request: CallToolRequest) => Promise<ToolResponse>): void;
    private handleInput;
    connect(): Promise<unknown>;
}
