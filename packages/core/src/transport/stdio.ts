import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Type alias for transport type
 */
export type TransportKind = 'stdio';

/**
 * Wrapper around StdioServerTransport for MCPKit
 * Provides a consistent interface and potential future enhancements
 */
export class StdioTransport implements Transport {
  readonly kind: TransportKind = 'stdio';
  private transport: StdioServerTransport;

  constructor() {
    this.transport = new StdioServerTransport();
  }

  get onclose() {
    return this.transport.onclose;
  }

  set onclose(handler: (() => void) | undefined) {
    this.transport.onclose = handler;
  }

  get onerror() {
    return this.transport.onerror;
  }

  set onerror(handler: ((error: Error) => void) | undefined) {
    this.transport.onerror = handler;
  }

  get onmessage() {
    return this.transport.onmessage;
  }

  set onmessage(handler: ((message: JSONRPCMessage) => void) | undefined) {
    this.transport.onmessage = handler;
  }

  async start(): Promise<void> {
    return this.transport.start();
  }

  async close(): Promise<void> {
    return this.transport.close();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return this.transport.send(message);
  }
}

/**
 * Create a new stdio transport instance
 */
export function createStdioTransport(): StdioTransport {
  return new StdioTransport();
}
