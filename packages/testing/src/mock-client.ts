import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { InMemoryTransport } from './transport.js';

/**
 * Options for creating a mock MCP client
 */
export interface MockClientOptions {
  /** Client name */
  name?: string;
  /** Client version */
  version?: string;
}

/**
 * Result from creating a mock client
 */
export interface MockClientResult {
  /** The MCP client instance */
  client: MockMcpClient;
  /** Transport for connecting to a server */
  serverTransport: Transport;
}

/**
 * Mock MCP client for testing servers
 *
 * Provides a simple interface for testing MCP server implementations
 * without needing actual network connections.
 *
 * @example
 * ```typescript
 * const { client, serverTransport } = MockMcpClient.create();
 *
 * // Connect your server to serverTransport
 * const server = await listen(MyServer);
 * await server.server.connect(serverTransport);
 *
 * // Use the client to test your server
 * const tools = await client.listTools();
 * const result = await client.callTool('myTool', { param: 'value' });
 * ```
 */
export class MockMcpClient {
  private client: Client;
  private clientTransport: InMemoryTransport;
  private connected = false;

  private constructor(options: MockClientOptions = {}) {
    this.client = new Client(
      {
        name: options.name ?? 'test-client',
        version: options.version ?? '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    this.clientTransport = new InMemoryTransport();
  }

  /**
   * Create a mock client with linked transports
   */
  static create(options?: MockClientOptions): MockClientResult {
    const mockClient = new MockMcpClient(options);
    const { clientTransport, serverTransport } = InMemoryTransport.createPair();

    mockClient.clientTransport = clientTransport;

    return {
      client: mockClient,
      serverTransport,
    };
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect(this.clientTransport);
    this.connected = true;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client.close();
    this.connected = false;
  }

  /**
   * List all available tools
   */
  async listTools() {
    await this.ensureConnected();
    return this.client.listTools();
  }

  /**
   * Call a tool by name
   */
  async callTool(name: string, args?: Record<string, unknown>) {
    await this.ensureConnected();
    return this.client.callTool({ name, arguments: args });
  }

  /**
   * List all available resources
   */
  async listResources() {
    await this.ensureConnected();
    return this.client.listResources();
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string) {
    await this.ensureConnected();
    return this.client.readResource({ uri });
  }

  /**
   * List all available prompts
   */
  async listPrompts() {
    await this.ensureConnected();
    return this.client.listPrompts();
  }

  /**
   * Get a prompt by name
   */
  async getPrompt(name: string, args?: Record<string, string>) {
    await this.ensureConnected();
    return this.client.getPrompt({ name, arguments: args });
  }

  /**
   * Ensure the client is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Get the underlying MCP client
   */
  get rawClient(): Client {
    return this.client;
  }
}
