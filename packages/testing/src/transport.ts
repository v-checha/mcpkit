import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * In-memory transport for testing MCP servers
 *
 * This transport allows direct communication between a client and server
 * without any network overhead, perfect for unit and integration tests.
 *
 * @example
 * ```typescript
 * const { clientTransport, serverTransport } = InMemoryTransport.createPair();
 *
 * // Connect server to serverTransport
 * await server.connect(serverTransport);
 *
 * // Use clientTransport to send messages
 * await clientTransport.send({ jsonrpc: '2.0', method: 'ping', id: 1 });
 * ```
 */
export class InMemoryTransport implements Transport {
  private peer: InMemoryTransport | null = null;
  private messageQueue: JSONRPCMessage[] = [];
  private started = false;
  private closed = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * Create a linked pair of transports for testing
   */
  static createPair(): { clientTransport: InMemoryTransport; serverTransport: InMemoryTransport } {
    const clientTransport = new InMemoryTransport();
    const serverTransport = new InMemoryTransport();

    clientTransport.peer = serverTransport;
    serverTransport.peer = clientTransport;

    return { clientTransport, serverTransport };
  }

  /**
   * Start the transport
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Transport already started');
    }
    if (this.closed) {
      throw new Error('Transport is closed');
    }

    this.started = true;

    // Process any queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.onmessage?.(message);
      }
    }
  }

  /**
   * Send a message to the peer transport
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) {
      throw new Error('Transport is closed');
    }

    if (!this.peer) {
      throw new Error('No peer transport connected');
    }

    // Simulate async behavior
    await Promise.resolve();

    if (this.peer.started) {
      this.peer.onmessage?.(message);
    } else {
      this.peer.messageQueue.push(message);
    }
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.onclose?.();

    // Also close peer
    if (this.peer && !this.peer.closed) {
      await this.peer.close();
    }
  }

  /**
   * Deliver a message directly (for testing purposes)
   */
  deliverMessage(message: JSONRPCMessage): void {
    if (this.started) {
      this.onmessage?.(message);
    } else {
      this.messageQueue.push(message);
    }
  }
}
