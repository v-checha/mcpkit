import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { InMemoryTransport } from './transport.js';

describe('InMemoryTransport', () => {
  describe('createPair', () => {
    it('should create a linked pair of transports', () => {
      const { clientTransport, serverTransport } = InMemoryTransport.createPair();

      expect(clientTransport).toBeInstanceOf(InMemoryTransport);
      expect(serverTransport).toBeInstanceOf(InMemoryTransport);
    });
  });

  describe('start', () => {
    it('should start the transport', async () => {
      const { clientTransport } = InMemoryTransport.createPair();

      await expect(clientTransport.start()).resolves.toBeUndefined();
    });

    it('should throw if already started', async () => {
      const { clientTransport } = InMemoryTransport.createPair();

      await clientTransport.start();
      await expect(clientTransport.start()).rejects.toThrow('Transport already started');
    });

    it('should throw if closed', async () => {
      const { clientTransport } = InMemoryTransport.createPair();

      await clientTransport.close();
      await expect(clientTransport.start()).rejects.toThrow('Transport is closed');
    });

    it('should process queued messages on start', async () => {
      const { clientTransport, serverTransport } = InMemoryTransport.createPair();
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test', id: 1 };
      const receivedMessages: JSONRPCMessage[] = [];

      clientTransport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };

      // Send before starting - should queue
      await serverTransport.start();
      await serverTransport.send(message);

      // Start client - should process queue
      await clientTransport.start();

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(message);
    });
  });

  describe('send', () => {
    it('should send message to peer', async () => {
      const { clientTransport, serverTransport } = InMemoryTransport.createPair();
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test', id: 1 };
      const receivedMessages: JSONRPCMessage[] = [];

      serverTransport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };

      await clientTransport.start();
      await serverTransport.start();
      await clientTransport.send(message);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(message);
    });

    it('should throw if closed', async () => {
      const { clientTransport } = InMemoryTransport.createPair();

      await clientTransport.close();
      await expect(clientTransport.send({ jsonrpc: '2.0', method: 'test', id: 1 })).rejects.toThrow(
        'Transport is closed',
      );
    });

    it('should throw if no peer connected', async () => {
      const transport = new InMemoryTransport();

      await expect(transport.send({ jsonrpc: '2.0', method: 'test', id: 1 })).rejects.toThrow(
        'No peer transport connected',
      );
    });
  });

  describe('close', () => {
    it('should close the transport', async () => {
      const { clientTransport } = InMemoryTransport.createPair();
      let closeCalled = false;

      clientTransport.onclose = () => {
        closeCalled = true;
      };

      await clientTransport.close();

      expect(closeCalled).toBe(true);
    });

    it('should close peer transport', async () => {
      const { clientTransport, serverTransport } = InMemoryTransport.createPair();
      let serverCloseCalled = false;

      serverTransport.onclose = () => {
        serverCloseCalled = true;
      };

      await clientTransport.close();

      expect(serverCloseCalled).toBe(true);
    });

    it('should be idempotent', async () => {
      const { clientTransport } = InMemoryTransport.createPair();

      await clientTransport.close();
      await expect(clientTransport.close()).resolves.toBeUndefined();
    });
  });

  describe('deliverMessage', () => {
    it('should deliver message directly when started', async () => {
      const transport = new InMemoryTransport();
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test', id: 1 };
      const receivedMessages: JSONRPCMessage[] = [];

      transport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };

      await transport.start();
      transport.deliverMessage(message);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(message);
    });

    it('should queue message when not started', async () => {
      const transport = new InMemoryTransport();
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test', id: 1 };
      const receivedMessages: JSONRPCMessage[] = [];

      transport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };

      transport.deliverMessage(message);
      expect(receivedMessages).toHaveLength(0);

      await transport.start();
      expect(receivedMessages).toHaveLength(1);
    });
  });

  describe('bidirectional communication', () => {
    it('should support bidirectional message passing', async () => {
      const { clientTransport, serverTransport } = InMemoryTransport.createPair();
      const clientMessages: JSONRPCMessage[] = [];
      const serverMessages: JSONRPCMessage[] = [];

      clientTransport.onmessage = (msg) => clientMessages.push(msg);
      serverTransport.onmessage = (msg) => serverMessages.push(msg);

      await clientTransport.start();
      await serverTransport.start();

      // Client to server
      await clientTransport.send({ jsonrpc: '2.0', method: 'ping', id: 1 });
      expect(serverMessages).toHaveLength(1);

      // Server to client
      await serverTransport.send({ jsonrpc: '2.0', result: 'pong', id: 1 });
      expect(clientMessages).toHaveLength(1);
    });
  });
});
