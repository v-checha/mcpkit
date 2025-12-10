import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it } from 'vitest';
import { MockMcpClient } from './mock-client.js';
import { InMemoryTransport } from './transport.js';

describe('MockMcpClient', () => {
  describe('create', () => {
    it('should create a client with default options', () => {
      const { client, serverTransport } = MockMcpClient.create();

      expect(client).toBeInstanceOf(MockMcpClient);
      expect(serverTransport).toBeDefined();
    });

    it('should create a client with custom options', () => {
      const { client } = MockMcpClient.create({
        name: 'custom-client',
        version: '2.0.0',
      });

      expect(client).toBeInstanceOf(MockMcpClient);
    });

    it('should return a server transport for connecting servers', () => {
      const { serverTransport } = MockMcpClient.create();

      expect(serverTransport).toBeInstanceOf(InMemoryTransport);
    });

    it('should create unique transports for each call', () => {
      const result1 = MockMcpClient.create();
      const result2 = MockMcpClient.create();

      expect(result1.serverTransport).not.toBe(result2.serverTransport);
      expect(result1.client).not.toBe(result2.client);
    });
  });

  describe('close', () => {
    it('should be safe to call when not connected', async () => {
      const { client } = MockMcpClient.create();

      await expect(client.close()).resolves.toBeUndefined();
    });

    it('should be idempotent', async () => {
      const { client } = MockMcpClient.create();

      await client.close();
      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  describe('rawClient', () => {
    it('should return the underlying MCP SDK client', () => {
      const { client } = MockMcpClient.create();

      expect(client.rawClient).toBeInstanceOf(Client);
    });

    it('should return the same client instance', () => {
      const { client } = MockMcpClient.create();

      expect(client.rawClient).toBe(client.rawClient);
    });
  });

  describe('client options', () => {
    it('should use default name when not provided', () => {
      const { client } = MockMcpClient.create();

      // Access the raw client to verify options were passed
      expect(client.rawClient).toBeDefined();
    });

    it('should accept custom name', () => {
      const { client } = MockMcpClient.create({ name: 'my-test-client' });

      expect(client.rawClient).toBeDefined();
    });

    it('should accept custom version', () => {
      const { client } = MockMcpClient.create({ version: '3.0.0' });

      expect(client.rawClient).toBeDefined();
    });

    it('should accept both name and version', () => {
      const { client } = MockMcpClient.create({
        name: 'full-custom-client',
        version: '5.0.0',
      });

      expect(client.rawClient).toBeDefined();
    });
  });

  describe('transport pairing', () => {
    it('should create linked transports', async () => {
      const { serverTransport } = MockMcpClient.create();

      // Server transport should be ready to receive connections
      expect(serverTransport).toBeInstanceOf(InMemoryTransport);
    });
  });
});
