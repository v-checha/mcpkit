import { type MockClientOptions, type MockClientResult, MockMcpClient } from './mock-client.js';

/**
 * Result from creating a test server
 */
export interface TestServerResult<T> {
  /** The server instance */
  instance: T;
  /** The bootstrapped server */
  server: {
    server: unknown;
    transport: unknown;
    connect: () => Promise<void>;
    close: () => Promise<void>;
  };
  /** The test client */
  client: MockMcpClient;
  /** Cleanup function */
  cleanup: () => Promise<void>;
}

/**
 * Create a test client for MCP server testing
 *
 * @example
 * ```typescript
 * const { client, serverTransport } = createTestClient();
 * ```
 */
export function createTestClient(options?: MockClientOptions): MockClientResult {
  return MockMcpClient.create(options);
}

/**
 * Wait for a condition to be true, with timeout
 *
 * @example
 * ```typescript
 * await waitForCondition(() => server.isReady, { timeout: 5000 });
 * ```
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a test server with a connected client
 *
 * This is a convenience function that sets up a complete test environment
 * with a server instance, bootstrapped server, and connected client.
 *
 * @example
 * ```typescript
 * import { createTestServer } from '@mcpkit-dev/testing';
 * import { listen } from '@mcpkit-dev/core';
 *
 * // In your test
 * const { client, cleanup } = await createTestServer(MyServer, listen);
 *
 * // Test your server
 * const tools = await client.listTools();
 * expect(tools.tools).toHaveLength(1);
 *
 * // Clean up
 * await cleanup();
 * ```
 */
export async function createTestServer<T extends new () => object>(
  ServerClass: T,
  listenFn: (ServerClass: T) => Promise<{
    server: unknown;
    transport: unknown;
    connect: () => Promise<void>;
    close: () => Promise<void>;
  }>,
): Promise<TestServerResult<InstanceType<T>>> {
  const { client, serverTransport } = createTestClient();
  const instance = new ServerClass() as InstanceType<T>;
  const bootstrapped = await listenFn(ServerClass);

  // Connect server to transport
  // We need to access the internal server and connect it
  const server = bootstrapped.server as {
    connect: (transport: unknown) => Promise<void>;
  };
  await server.connect(serverTransport);

  // Connect client
  await client.connect();

  return {
    instance,
    server: bootstrapped,
    client,
    cleanup: async () => {
      await client.close();
      await bootstrapped.close();
    },
  };
}
