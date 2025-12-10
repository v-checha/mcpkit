import { describe, expect, it } from 'vitest';
import { createTestClient, waitForCondition } from './helpers.js';
import { MockMcpClient } from './mock-client.js';

describe('helpers', () => {
  describe('createTestClient', () => {
    it('should create a mock client with server transport', () => {
      const { client, serverTransport } = createTestClient();

      expect(client).toBeInstanceOf(MockMcpClient);
      expect(serverTransport).toBeDefined();
    });

    it('should accept custom options', () => {
      const { client } = createTestClient({
        name: 'custom-client',
        version: '2.0.0',
      });

      expect(client).toBeInstanceOf(MockMcpClient);
    });
  });

  describe('waitForCondition', () => {
    it('should resolve when condition is immediately true', async () => {
      await expect(waitForCondition(() => true)).resolves.toBeUndefined();
    });

    it('should resolve when condition becomes true', async () => {
      let counter = 0;

      await expect(
        waitForCondition(() => {
          counter++;
          return counter >= 3;
        }),
      ).resolves.toBeUndefined();

      expect(counter).toBeGreaterThanOrEqual(3);
    });

    it('should support async conditions', async () => {
      let counter = 0;

      await expect(
        waitForCondition(async () => {
          counter++;
          return counter >= 2;
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw on timeout', async () => {
      await expect(waitForCondition(() => false, { timeout: 100, interval: 10 })).rejects.toThrow(
        'Condition not met within 100ms',
      );
    });

    it('should respect custom timeout', async () => {
      const start = Date.now();

      await expect(waitForCondition(() => false, { timeout: 50, interval: 10 })).rejects.toThrow();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(200);
    });

    it('should respect custom interval', async () => {
      let checkCount = 0;

      try {
        await waitForCondition(
          () => {
            checkCount++;
            return false;
          },
          { timeout: 100, interval: 30 },
        );
      } catch {
        // Expected to throw
      }

      // With 100ms timeout and 30ms interval, should check about 3-4 times
      expect(checkCount).toBeGreaterThanOrEqual(2);
      expect(checkCount).toBeLessThanOrEqual(6);
    });

    it('should use default options', async () => {
      // This should succeed quickly with defaults
      await expect(waitForCondition(() => true)).resolves.toBeUndefined();
    });
  });
});
