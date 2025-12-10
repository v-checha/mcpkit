import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

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
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Only handle requests to the MCP path
    if (url.pathname !== this.options.path) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Add CORS headers for browser clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Get or create transport for this session
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    const existingTransport = sessionId ? this.transports.get(sessionId) : undefined;

    if (existingTransport) {
      // Existing session
      const body = await this.parseBody(req);
      await existingTransport.handleRequest(req, res, body);
    } else if (req.method === 'POST') {
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
      const body = await this.parseBody(req);
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
