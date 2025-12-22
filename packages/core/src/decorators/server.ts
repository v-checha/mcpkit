import 'reflect-metadata';
import { MetadataStorage, type ServerOptionsMetadata } from '../metadata/index.js';
import type { MiddlewareInput } from '../middleware/index.js';
import type { PluginInput } from '../plugins/index.js';
import { type BootstrappedServer, bootstrapServer } from '../server/index.js';
import type { ServerHooks } from '../types/hooks.js';
import type { ListenOptions, MCPServerInstance } from '../types/index.js';

/**
 * Options for the @MCPServer decorator
 */
export interface MCPServerDecoratorOptions {
  /**
   * Server name - displayed to clients
   */
  name: string;

  /**
   * Server version - semantic versioning recommended
   */
  version: string;

  /**
   * Human-readable description of the server
   */
  description?: string;

  /**
   * Capability flags - all enabled by default
   */
  capabilities?: {
    /** Enable tool registration (default: true) */
    tools?: boolean;
    /** Enable resource registration (default: true) */
    resources?: boolean;
    /** Enable prompt registration (default: true) */
    prompts?: boolean;
  };

  /**
   * Server lifecycle and monitoring hooks
   *
   * @example
   * ```typescript
   * @MCPServer({
   *   name: 'my-server',
   *   version: '1.0.0',
   *   hooks: {
   *     onToolCall: ({ toolName, args }) => {
   *       console.error(`Tool ${toolName} called`);
   *     },
   *     onToolSuccess: ({ toolName, duration }) => {
   *       console.error(`Tool ${toolName} completed in ${duration}ms`);
   *     },
   *   }
   * })
   * ```
   */
  hooks?: ServerHooks;

  /**
   * Middleware to run before handling HTTP requests
   * Only applies to HTTP transports (streamable-http, sse)
   *
   * @example
   * ```typescript
   * import { apiKeyAuth, rateLimit } from '@mcpkit-dev/core';
   *
   * @MCPServer({
   *   name: 'my-server',
   *   version: '1.0.0',
   *   middleware: [
   *     apiKeyAuth({
   *       header: 'x-api-key',
   *       validate: (key) => key === process.env.API_KEY
   *     }),
   *     rateLimit({ maxRequests: 100, windowMs: 60000 })
   *   ]
   * })
   * ```
   */
  middleware?: MiddlewareInput[];

  /**
   * Plugins to extend server functionality
   *
   * @example
   * ```typescript
   * import { createPlugin, definePlugin } from '@mcpkit-dev/core';
   *
   * const loggingPlugin = createPlugin({
   *   name: 'logging',
   *   version: '1.0.0',
   *   hooks: {
   *     onToolCall: ({ name }) => console.log(`Tool: ${name}`),
   *   },
   * });
   *
   * @MCPServer({
   *   name: 'my-server',
   *   version: '1.0.0',
   *   plugins: [loggingPlugin],
   * })
   * ```
   */
  plugins?: PluginInput[];
}

/**
 * Class decorator that marks a class as an MCP server
 *
 * This decorator:
 * 1. Stores server configuration metadata
 * 2. Extends the class with `listen()`, `close()`, and `isConnected()` methods
 * 3. Handles server lifecycle management
 *
 * @example
 * ```typescript
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   description: 'A helpful MCP server'
 * })
 * class MyServer {
 *   @Tool({ description: 'Say hello' })
 *   async greet(@Param({ name: 'name' }) name: string) {
 *     return `Hello, ${name}!`;
 *   }
 * }
 *
 * const server = new MyServer();
 * await server.listen(); // Starts stdio transport by default
 * ```
 */
export function MCPServer(
  options: MCPServerDecoratorOptions,
): <T extends new (...args: any[]) => object>(target: T) => T {
  return function <T extends new (...args: any[]) => object>(target: T): T {
    // Store server options as metadata on the constructor
    const serverOptions: ServerOptionsMetadata = {
      name: options.name,
      version: options.version,
      description: options.description,
      capabilities: options.capabilities,
      hooks: options.hooks,
      middleware: options.middleware,
      plugins: options.plugins,
    };
    MetadataStorage.setServerOptions(target, serverOptions);

    // Create extended class with server methods
    const ExtendedClass = class extends target implements MCPServerInstance {
      private __mcpBootstrapped: BootstrappedServer | null = null;

      constructor(...args: any[]) {
        super(...args);
      }

      /**
       * Start the MCP server with the specified transport
       *
       * @param listenOptions - Configuration for the server transport
       * @returns Promise that resolves when the server is connected
       */
      async listen(listenOptions: ListenOptions = {}): Promise<void> {
        if (this.__mcpBootstrapped) {
          throw new Error('Server is already running. Call close() first.');
        }

        const serverOpts = MetadataStorage.getServerOptions(target);
        if (!serverOpts) {
          throw new Error('Server options not found. Ensure @MCPServer decorator is applied.');
        }

        this.__mcpBootstrapped = await bootstrapServer(this, serverOpts, listenOptions);
        await this.__mcpBootstrapped.connect();

        // Call onServerStart hook
        if (serverOpts.hooks?.onServerStart) {
          const promise = serverOpts.hooks.onServerStart();
          if (serverOpts.hooks.awaitHooks !== false && promise) {
            await promise;
          }
        }
      }

      /**
       * Gracefully shut down the server
       *
       * @returns Promise that resolves when the server is closed
       */
      async close(): Promise<void> {
        if (this.__mcpBootstrapped) {
          const serverOpts = MetadataStorage.getServerOptions(target);
          await this.__mcpBootstrapped.close();
          this.__mcpBootstrapped = null;

          // Call onServerStop hook
          if (serverOpts?.hooks?.onServerStop) {
            const promise = serverOpts.hooks.onServerStop();
            if (serverOpts.hooks.awaitHooks !== false && promise) {
              await promise;
            }
          }
        }
      }

      /**
       * Check if server is currently connected
       *
       * @returns true if the server is running
       */
      isConnected(): boolean {
        return this.__mcpBootstrapped !== null;
      }
    };

    // Preserve the original class name
    Object.defineProperty(ExtendedClass, 'name', {
      value: target.name,
      writable: false,
    });

    return ExtendedClass as T;
  };
}
