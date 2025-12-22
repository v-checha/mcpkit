import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  type MiddlewareContext,
  type MiddlewareInput,
  MiddlewarePipeline,
} from '../middleware/index.js';

/**
 * Options for creating a Streamable HTTP transport
 */
export interface StreamableHttpTransportOptions {
  /**
   * Port to listen on
   * @default 3000
   */
  port?: number;

  /**
   * Host to bind to
   * @default 'localhost'
   */
  host?: string;

  /**
   * Path for the MCP endpoint
   * @default '/mcp'
   */
  path?: string;

  /**
   * Enable stateless mode (no session management)
   * @default false
   */
  stateless?: boolean;

  /**
   * Enable JSON responses instead of SSE streams
   * @default false
   */
  enableJsonResponse?: boolean;

  /**
   * Callback when a session is initialized
   */
  onSessionInitialized?: (sessionId: string) => void;

  /**
   * Callback when a session is closed
   */
  onSessionClosed?: (sessionId: string) => void;

  /**
   * Middleware to execute before handling MCP requests
   * Middleware runs for all HTTP requests to the server
   */
  middleware?: MiddlewareInput[];
}

/**
 * Streamable HTTP transport for MCP servers
 *
 * This transport implements the MCP Streamable HTTP specification,
 * supporting both SSE streaming and direct HTTP responses.
 *
 * @example
 * ```typescript
 * const transport = new StreamableHttpTransport({
 *   port: 3000,
 *   host: 'localhost',
 *   path: '/mcp',
 * });
 *
 * await transport.start();
 * ```
 */
export class StreamableHttpTransport implements Transport {
  readonly kind = 'streamable-http' as const;

  private options: Required<Pick<StreamableHttpTransportOptions, 'port' | 'host' | 'path'>> &
    StreamableHttpTransportOptions;
  private server: Server | null = null;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();
  private activeTransport: StreamableHTTPServerTransport | null = null;
  private middlewarePipeline: MiddlewarePipeline;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: StreamableHttpTransportOptions = {}) {
    this.options = {
      port: 3000,
      host: 'localhost',
      path: '/mcp',
      ...options,
    };

    // Initialize middleware pipeline
    this.middlewarePipeline = new MiddlewarePipeline();
    if (options.middleware) {
      this.middlewarePipeline.useAll(options.middleware);
    }
  }

  /**
   * Add middleware to the transport
   * Can be called before start() to add additional middleware
   *
   * @param middleware - Middleware function or named middleware
   * @returns this for chaining
   */
  use(middleware: MiddlewareInput): this {
    this.middlewarePipeline.use(middleware);
    return this;
  }

  /**
   * Start the HTTP server and begin listening for connections
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.onerror?.(error);
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Add CORS headers for browser clients (before middleware for preflight)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, mcp-session-id, Authorization, X-API-Key',
    );

    // Handle CORS preflight (before middleware)
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse body early so middleware can access it
    const body = await this.parseBody(req);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Execute middleware pipeline, then handle MCP request
    try {
      await this.middlewarePipeline.execute(
        req,
        res,
        sessionId,
        body,
        async (ctx: MiddlewareContext) => {
          // Middleware completed - handle MCP request
          await this.handleMcpRequest(ctx);
        },
      );
    } catch (error) {
      // Middleware threw an error
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  }

  /**
   * Handle MCP-specific request after middleware
   */
  private async handleMcpRequest(ctx: MiddlewareContext): Promise<void> {
    const { request: req, response: res, sessionId, body, path } = ctx;

    // Only handle requests to the MCP path
    if (path !== this.options.path) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const existingTransport = sessionId ? this.transports.get(sessionId) : undefined;

    if (existingTransport) {
      // Existing session
      await existingTransport.handleRequest(req, res, body);
    } else if (ctx.method === 'POST') {
      // New session - create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: this.options.stateless ? undefined : () => randomUUID(),
        enableJsonResponse: this.options.enableJsonResponse,
        onsessioninitialized: (id) => {
          this.transports.set(id, transport);
          this.activeTransport = transport;
          this.options.onSessionInitialized?.(id);
        },
        onsessionclosed: (id) => {
          this.transports.delete(id);
          if (this.activeTransport === transport) {
            this.activeTransport = null;
          }
          this.options.onSessionClosed?.(id);
        },
      });

      // Wire up message handling
      transport.onmessage = (message) => {
        this.onmessage?.(message);
      };

      transport.onerror = (error) => {
        this.onerror?.(error);
      };

      transport.onclose = () => {
        // Handle transport close
      };

      // Handle the request
      await transport.handleRequest(req, res, body);

      // Store for stateless mode
      if (this.options.stateless && !this.activeTransport) {
        this.activeTransport = transport;
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session ID required for non-POST requests' }));
    }
  }

  /**
   * Parse request body as JSON
   */
  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (body) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(undefined);
          }
        } else {
          resolve(undefined);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Close the HTTP server and all active transports
   */
  async close(): Promise<void> {
    // Close all active transports
    for (const transport of this.transports.values()) {
      await transport.close();
    }
    this.transports.clear();
    this.activeTransport = null;

    // Close the HTTP server
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.server = null;
            this.onclose?.();
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a message to the client
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.activeTransport) {
      await this.activeTransport.send(message);
    } else {
      throw new Error('No active transport to send message');
    }
  }

  /**
   * Get the server URL
   */
  get url(): string {
    return `http://${this.options.host}:${this.options.port}${this.options.path}`;
  }

  /**
   * Get the port the server is listening on
   */
  get port(): number {
    return this.options.port;
  }
}

/**
 * Create a new Streamable HTTP transport
 */
export function createStreamableHttpTransport(
  options?: StreamableHttpTransportOptions,
): StreamableHttpTransport {
  return new StreamableHttpTransport(options);
}
