/**
 * Supported transport types
 */
export type TransportType = 'stdio' | 'http' | 'sse' | 'streamable-http';

/**
 * Options for starting the MCP server
 */
export interface ListenOptions {
  /**
   * Transport type to use
   * @default 'stdio'
   */
  transport?: TransportType;

  /**
   * Port number for HTTP transports
   * @default 3000
   */
  port?: number;

  /**
   * Host for HTTP transports
   * @default 'localhost'
   */
  host?: string;

  /**
   * Path for Streamable HTTP endpoint
   * @default '/mcp'
   */
  path?: string;

  /**
   * Path for SSE stream endpoint (SSE transport only)
   * @default '/sse'
   */
  ssePath?: string;

  /**
   * Path for message endpoint (SSE transport only)
   * @default '/message'
   */
  messagePath?: string;

  /**
   * Enable stateless mode for Streamable HTTP (no session management)
   * @default false
   */
  stateless?: boolean;

  /**
   * Enable JSON responses instead of SSE streams (Streamable HTTP only)
   * @default false
   */
  enableJsonResponse?: boolean;

  /**
   * Callback when a session is initialized (Streamable HTTP only)
   */
  onSessionInitialized?: (sessionId: string) => void;

  /**
   * Callback when a session is closed (Streamable HTTP only)
   */
  onSessionClosed?: (sessionId: string) => void;
}

/**
 * Interface that decorated classes implement
 * Added automatically by @MCPServer decorator
 */
export interface MCPServerInstance {
  /**
   * Start the MCP server with specified transport
   */
  listen(options?: ListenOptions): Promise<void>;

  /**
   * Gracefully shut down the server
   */
  close(): Promise<void>;

  /**
   * Check if server is currently connected
   */
  isConnected(): boolean;
}

/**
 * Content types for tool results
 */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ToolResultContent = TextContent | ImageContent | ResourceContent;

/**
 * Tool result format
 */
export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
}

/**
 * Resource content format
 */
export interface ResourceContentItem {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Resource read result
 */
export interface ResourceResult {
  contents: ResourceContentItem[];
}

/**
 * Prompt message role
 */
export type PromptRole = 'user' | 'assistant';

/**
 * Prompt message content
 */
export interface PromptMessageContent {
  type: 'text';
  text: string;
}

/**
 * Prompt message
 */
export interface PromptMessage {
  role: PromptRole;
  content: PromptMessageContent;
}

/**
 * Prompt result format
 */
export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}
