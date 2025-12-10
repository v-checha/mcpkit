import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Options for creating an SSE HTTP transport
 */
export interface SseTransportOptions {
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
   * Path for SSE stream endpoint (GET)
   * @default '/sse'
   */
  ssePath?: string;

  /**
   * Path for message endpoint (POST)
   * @default '/message'
   */
  messagePath?: string;
}

/**
 * SSE HTTP transport for MCP servers
 *
 * @deprecated Use StreamableHttpTransport instead. SSE transport is provided
 * for backward compatibility with older clients.
 *
 * This transport uses:
 * - GET /sse - Establishes SSE stream for server-to-client messages
 * - POST /message - Client-to-server messages
 *
 * @example
 * ```typescript
 * const transport = new SseTransport({
 *   port: 3000,
 *   host: 'localhost',
 * });
 *
 * await transport.start();
 * ```
 */
export class SseTransport implements Transport {
  readonly kind = 'sse' as const;

  private options: Required<SseTransportOptions>;
  private server: Server | null = null;
  private sseTransport: SSEServerTransport | null = null;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: SseTransportOptions = {}) {
    this.options = {
      port: 3000,
      host: 'localhost',
      ssePath: '/sse',
      messagePath: '/message',
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

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // SSE endpoint - establish stream
    if (url.pathname === this.options.ssePath && req.method === 'GET') {
      await this.handleSseConnection(res);
      return;
    }

    // Message endpoint - receive client messages
    if (url.pathname === this.options.messagePath && req.method === 'POST') {
      await this.handleMessage(req, res);
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Handle SSE connection establishment
   */
  private async handleSseConnection(res: ServerResponse): Promise<void> {
    // Create new SSE transport
    this.sseTransport = new SSEServerTransport(this.options.messagePath, res);

    // Wire up message handling
    this.sseTransport.onmessage = (message) => {
      this.onmessage?.(message);
    };

    this.sseTransport.onerror = (error) => {
      this.onerror?.(error);
    };

    this.sseTransport.onclose = () => {
      this.sseTransport = null;
    };

    // Start the SSE stream
    await this.sseTransport.start();
  }

  /**
   * Handle incoming POST messages
   */
  private async handleMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.sseTransport) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active SSE connection' }));
      return;
    }

    const body = await this.parseBody(req);
    await this.sseTransport.handlePostMessage(req, res, body);
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
   * Close the HTTP server and SSE transport
   */
  async close(): Promise<void> {
    // Close SSE transport
    if (this.sseTransport) {
      await this.sseTransport.close();
      this.sseTransport = null;
    }

    // Close HTTP server
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
    if (this.sseTransport) {
      await this.sseTransport.send(message);
    } else {
      throw new Error('No active SSE transport');
    }
  }

  /**
   * Get the SSE URL for clients to connect to
   */
  get sseUrl(): string {
    return `http://${this.options.host}:${this.options.port}${this.options.ssePath}`;
  }

  /**
   * Get the message URL for clients to POST to
   */
  get messageUrl(): string {
    return `http://${this.options.host}:${this.options.port}${this.options.messagePath}`;
  }

  /**
   * Get the port the server is listening on
   */
  get port(): number {
    return this.options.port;
  }
}

/**
 * Create a new SSE transport
 * @deprecated Use createStreamableHttpTransport instead
 */
export function createSseTransport(options?: SseTransportOptions): SseTransport {
  return new SseTransport(options);
}
