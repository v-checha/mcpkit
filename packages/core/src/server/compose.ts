/**
 * Multi-server composition utilities
 *
 * Allows composing multiple MCP server classes into a single server.
 */

import { MetadataStorage, type ServerOptionsMetadata } from '../metadata/index.js';
import type { MiddlewareInput } from '../middleware/types.js';
import type { PluginInput } from '../plugins/types.js';
import type { ServerHooks } from '../types/hooks.js';
import type { ListenOptions } from '../types/index.js';
import { type BootstrappedServer, bootstrapServer } from './bootstrap.js';

/**
 * Options for composed server
 */
export interface ComposeOptions {
  /**
   * Server name for the composed server
   */
  name: string;

  /**
   * Server version
   */
  version: string;

  /**
   * Server description
   */
  description?: string;

  /**
   * Global hooks applied to all servers
   */
  hooks?: ServerHooks;

  /**
   * Global middleware applied to all servers (HTTP transports only)
   */
  middleware?: MiddlewareInput[];

  /**
   * Plugins for the composed server
   */
  plugins?: PluginInput[];
}

/**
 * Server instance with its tools, resources, and prompts
 */
export interface ComposedServerInstance {
  /**
   * The server class instance
   */
  instance: object;

  /**
   * Optional prefix for tool names
   */
  toolPrefix?: string;

  /**
   * Optional prefix for resource URIs
   */
  resourcePrefix?: string;

  /**
   * Optional prefix for prompt names
   */
  promptPrefix?: string;
}

/**
 * Result of composing servers
 */
export interface ComposedServerMetadata extends ServerOptionsMetadata {
  /**
   * Original server instances that were composed
   */
  servers: ComposedServerInstance[];
}

/**
 * Compose multiple server class instances into a combined server
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'weather', version: '1.0.0' })
 * class WeatherServer {
 *   @Tool({ description: 'Get weather' })
 *   async getWeather(@Param({ name: 'city' }) city: string) {
 *     return `Weather in ${city}`;
 *   }
 * }
 *
 * @MCPServer({ name: 'news', version: '1.0.0' })
 * class NewsServer {
 *   @Tool({ description: 'Get news' })
 *   async getNews(@Param({ name: 'topic' }) topic: string) {
 *     return `News about ${topic}`;
 *   }
 * }
 *
 * const composed = composeServers({
 *   name: 'combined-server',
 *   version: '1.0.0',
 *   servers: [
 *     { instance: new WeatherServer(), toolPrefix: 'weather_' },
 *     { instance: new NewsServer(), toolPrefix: 'news_' },
 *   ],
 * });
 *
 * await composed.listen();
 * ```
 */
export function composeServers(
  options: ComposeOptions & { servers: ComposedServerInstance[] },
): ComposedServerMetadata {
  const allTools: import('../metadata/storage.js').ToolMetadata[] = [];
  const allResources: import('../metadata/storage.js').ResourceMetadata[] = [];
  const allPrompts: import('../metadata/storage.js').PromptMetadata[] = [];
  const hooksList: Partial<ServerHooks>[] = [];
  const middlewareList: MiddlewareInput[] = [];
  const pluginsList: PluginInput[] = [];

  // Add global hooks if provided
  if (options.hooks) {
    hooksList.push(options.hooks);
  }

  // Add global middleware if provided
  if (options.middleware) {
    middlewareList.push(...options.middleware);
  }

  // Add global plugins if provided
  if (options.plugins) {
    pluginsList.push(...options.plugins);
  }

  // Process each server
  for (const serverEntry of options.servers) {
    const { instance, toolPrefix = '', resourcePrefix = '', promptPrefix = '' } = serverEntry;
    const prototype = Object.getPrototypeOf(instance);
    const ctor = prototype.constructor;

    // Get server options if decorated with @MCPServer
    const serverOpts = MetadataStorage.getServerOptions(ctor);
    if (serverOpts) {
      // Collect hooks from each server
      if (serverOpts.hooks) {
        hooksList.push(serverOpts.hooks);
      }

      // Collect middleware from each server
      if (serverOpts.middleware) {
        middlewareList.push(...serverOpts.middleware);
      }

      // Collect plugins from each server
      if (serverOpts.plugins) {
        pluginsList.push(...serverOpts.plugins);
      }
    }

    // Get tools and add prefix
    const tools = MetadataStorage.getToolsMetadata(prototype);
    for (const tool of tools) {
      allTools.push({
        ...tool,
        name: tool.name ? `${toolPrefix}${tool.name}` : `${toolPrefix}${String(tool.propertyKey)}`,
      });
    }

    // Get resources and add prefix
    const resources = MetadataStorage.getResourcesMetadata(prototype);
    for (const resource of resources) {
      allResources.push({
        ...resource,
        uri: resourcePrefix ? `${resourcePrefix}${resource.uri}` : resource.uri,
        name: resource.name ? `${resourcePrefix}${resource.name}` : undefined,
      });
    }

    // Get prompts and add prefix
    const prompts = MetadataStorage.getPromptsMetadata(prototype);
    for (const prompt of prompts) {
      allPrompts.push({
        ...prompt,
        name: prompt.name
          ? `${promptPrefix}${prompt.name}`
          : `${promptPrefix}${String(prompt.propertyKey)}`,
      });
    }
  }

  // Merge all hooks into one
  const mergedHooks = mergeHooksForComposition(hooksList);

  return {
    name: options.name,
    version: options.version,
    description: options.description,
    capabilities: {
      tools: allTools.length > 0,
      resources: allResources.length > 0,
      prompts: allPrompts.length > 0,
    },
    hooks: mergedHooks,
    middleware: middlewareList.length > 0 ? middlewareList : undefined,
    plugins: pluginsList.length > 0 ? pluginsList : undefined,
    servers: options.servers,
  };
}

/**
 * Merge multiple hook objects into one
 */
function mergeHooksForComposition(hooksList: Partial<ServerHooks>[]): ServerHooks | undefined {
  if (hooksList.length === 0) return undefined;
  if (hooksList.length === 1) return hooksList[0] as ServerHooks;

  const merged: Partial<ServerHooks> = {};

  const hookNames: (keyof ServerHooks)[] = [
    'onServerStart',
    'onServerStop',
    'onToolCall',
    'onToolSuccess',
    'onToolError',
    'onResourceRead',
    'onResourceSuccess',
    'onResourceError',
    'onPromptGet',
    'onPromptSuccess',
    'onPromptError',
  ];

  for (const hookName of hookNames) {
    const handlers = hooksList
      .map((h) => h[hookName])
      .filter((h): h is NonNullable<typeof h> => h !== undefined);

    if (handlers.length > 0) {
      (merged as any)[hookName] = async (...args: unknown[]) => {
        for (const handler of handlers) {
          await (handler as any)(...args);
        }
      };
    }
  }

  // Merge awaitHooks - if any source says false, use false
  merged.awaitHooks = hooksList.every((h) => h.awaitHooks !== false);

  return merged as ServerHooks;
}

/**
 * Create a class that represents a composed server
 *
 * @example
 * ```typescript
 * const ComposedServer = createComposedServer({
 *   name: 'combined-server',
 *   version: '1.0.0',
 *   servers: [
 *     { instance: new WeatherServer(), toolPrefix: 'weather_' },
 *     { instance: new NewsServer(), toolPrefix: 'news_' },
 *   ],
 * });
 *
 * const server = new ComposedServer();
 * await server.listen();
 * ```
 */
export function createComposedServer(
  options: ComposeOptions & { servers: ComposedServerInstance[] },
): new () => ComposedServerClass {
  const metadata = composeServers(options);

  // Create a new class that will hold the composed metadata
  class ComposedServer implements ComposedServerClass {
    readonly __composedMetadata = metadata;
    readonly __serverInstances = options.servers.map((s) => s.instance);
    private __mcpBootstrapped: BootstrappedServer | null = null;

    /**
     * Get all composed server instances
     */
    getServers(): object[] {
      return this.__serverInstances;
    }

    /**
     * Get a specific server instance by index
     */
    getServer(index: number): object | undefined {
      return this.__serverInstances[index];
    }

    /**
     * Get composition metadata
     */
    getMetadata(): ComposedServerMetadata {
      return this.__composedMetadata;
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

      this.__mcpBootstrapped = await bootstrapServer(this, metadata, listenOptions);
      await this.__mcpBootstrapped.connect();

      // Call onServerStart hook
      if (metadata.hooks?.onServerStart) {
        const promise = metadata.hooks.onServerStart();
        if (metadata.hooks.awaitHooks !== false && promise) {
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
        await this.__mcpBootstrapped.close();
        this.__mcpBootstrapped = null;

        // Call onServerStop hook
        if (metadata.hooks?.onServerStop) {
          const promise = metadata.hooks.onServerStop();
          if (metadata.hooks.awaitHooks !== false && promise) {
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
  }

  // Store the composed metadata on the constructor for bootstrap
  MetadataStorage.setServerOptions(ComposedServer, metadata);

  return ComposedServer;
}

/**
 * Interface for composed server class
 */
export interface ComposedServerClass {
  /**
   * Get all composed server instances
   */
  getServers(): object[];

  /**
   * Get a specific server instance by index
   */
  getServer(index: number): object | undefined;

  /**
   * Get composition metadata
   */
  getMetadata(): ComposedServerMetadata;

  /**
   * Start the MCP server with the specified transport
   */
  listen(options?: ListenOptions): Promise<void>;

  /**
   * Gracefully shut down the server
   */
  close(): Promise<void>;

  /**
   * Check if server is currently connected
   */
  isConnected(): boolean;
}

/**
 * Helper to combine tools from multiple sources
 */
export function combineTools(
  sources: Array<{
    prototype: object;
    prefix?: string;
  }>,
): import('../metadata/storage.js').ToolMetadata[] {
  const tools: import('../metadata/storage.js').ToolMetadata[] = [];

  for (const { prototype, prefix = '' } of sources) {
    const sourceTools = MetadataStorage.getToolsMetadata(prototype);
    for (const tool of sourceTools) {
      tools.push({
        ...tool,
        name: tool.name ? `${prefix}${tool.name}` : `${prefix}${String(tool.propertyKey)}`,
      });
    }
  }

  return tools;
}

/**
 * Helper to combine resources from multiple sources
 */
export function combineResources(
  sources: Array<{
    prototype: object;
    prefix?: string;
  }>,
): import('../metadata/storage.js').ResourceMetadata[] {
  const resources: import('../metadata/storage.js').ResourceMetadata[] = [];

  for (const { prototype, prefix = '' } of sources) {
    const sourceResources = MetadataStorage.getResourcesMetadata(prototype);
    for (const resource of sourceResources) {
      resources.push({
        ...resource,
        uri: prefix ? `${prefix}${resource.uri}` : resource.uri,
        name: resource.name ? `${prefix}${resource.name}` : undefined,
      });
    }
  }

  return resources;
}

/**
 * Helper to combine prompts from multiple sources
 */
export function combinePrompts(
  sources: Array<{
    prototype: object;
    prefix?: string;
  }>,
): import('../metadata/storage.js').PromptMetadata[] {
  const prompts: import('../metadata/storage.js').PromptMetadata[] = [];

  for (const { prototype, prefix = '' } of sources) {
    const sourcePrompts = MetadataStorage.getPromptsMetadata(prototype);
    for (const prompt of sourcePrompts) {
      prompts.push({
        ...prompt,
        name: prompt.name ? `${prefix}${prompt.name}` : `${prefix}${String(prompt.propertyKey)}`,
      });
    }
  }

  return prompts;
}
