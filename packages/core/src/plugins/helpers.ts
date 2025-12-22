/**
 * Plugin helper utilities
 *
 * Simplifies plugin creation and common patterns.
 */

import type { Middleware } from '../middleware/types.js';
import type { ServerHooks } from '../types/hooks.js';
import type { MCPKitPlugin, PluginFactory } from './types.js';

/**
 * Options for creating a simple plugin
 */
export interface SimplePluginOptions {
  /**
   * Plugin name
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Middleware to register
   */
  middleware?: Middleware | Middleware[];

  /**
   * Hooks to register
   */
  hooks?: Partial<ServerHooks>;

  /**
   * Called when plugin is registered
   */
  onRegister?: (ctx: import('./types.js').PluginContext) => void | Promise<void>;

  /**
   * Called before server starts
   */
  onBeforeStart?: (ctx: import('./types.js').PluginContext) => void | Promise<void>;

  /**
   * Called when server starts
   */
  onServerStart?: (
    ctx: import('./types.js').PluginContext,
    server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer,
  ) => void | Promise<void>;

  /**
   * Called when server stops
   */
  onServerStop?: (ctx: import('./types.js').PluginContext) => void | Promise<void>;
}

/**
 * Create a simple plugin with middleware and/or hooks
 *
 * @example
 * ```typescript
 * const loggingPlugin = createPlugin({
 *   name: 'logging',
 *   version: '1.0.0',
 *   middleware: async (ctx, next) => {
 *     console.log(`Request: ${ctx.method} ${ctx.path}`);
 *     await next();
 *   },
 *   hooks: {
 *     onToolCall: async ({ name }) => {
 *       console.log(`Tool called: ${name}`);
 *     },
 *   },
 * });
 * ```
 */
export function createPlugin(options: SimplePluginOptions): MCPKitPlugin {
  const middleware = options.middleware
    ? Array.isArray(options.middleware)
      ? options.middleware
      : [options.middleware]
    : undefined;

  return {
    name: options.name,
    version: options.version,
    description: options.description,
    middleware,
    hooks: options.hooks,
    onRegister: options.onRegister,
    onBeforeStart: options.onBeforeStart,
    onServerStart: options.onServerStart,
    onServerStop: options.onServerStop,
  };
}

/**
 * Create a configurable plugin factory
 *
 * @example
 * ```typescript
 * interface CacheOptions {
 *   ttl?: number;
 *   maxSize?: number;
 * }
 *
 * const cachePlugin = definePlugin<CacheOptions>({
 *   name: 'cache',
 *   version: '1.0.0',
 *   setup(options, ctx) {
 *     const cache = new Map();
 *     const ttl = options?.ttl ?? 60000;
 *
 *     ctx.useHooks({
 *       onToolCall: async ({ name, args }) => {
 *         const key = `${name}:${JSON.stringify(args)}`;
 *         if (cache.has(key)) {
 *           return cache.get(key);
 *         }
 *       },
 *       onToolSuccess: async ({ name, args, result }) => {
 *         const key = `${name}:${JSON.stringify(args)}`;
 *         cache.set(key, result);
 *         setTimeout(() => cache.delete(key), ttl);
 *       },
 *     });
 *
 *     return {
 *       clear: () => cache.clear(),
 *       size: () => cache.size,
 *     };
 *   },
 * });
 *
 * // Usage
 * @MCPServer({
 *   plugins: [cachePlugin({ ttl: 30000 })],
 * })
 * ```
 */
export function definePlugin<
  TOptions = void,
  TApi extends Record<string, unknown> = Record<string, unknown>,
>(config: {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  setup: (
    options: TOptions,
    ctx: import('./types.js').PluginContext,
  ) => TApi | void | Promise<TApi | void>;
}): PluginFactory<TOptions> {
  return (options?: TOptions): MCPKitPlugin => {
    let api: TApi | undefined;

    return {
      name: config.name,
      version: config.version,
      description: config.description,
      dependencies: config.dependencies,

      async onRegister(ctx) {
        const result = await config.setup(options as TOptions, ctx);
        if (result !== undefined) {
          api = result;
        }
      },

      get api() {
        return api;
      },
    };
  };
}

/**
 * Combine multiple plugins into one
 *
 * @example
 * ```typescript
 * const securityBundle = combinePlugins(
 *   'security-bundle',
 *   '1.0.0',
 *   [authPlugin(), rateLimitPlugin(), corsPlugin()],
 * );
 * ```
 */
export function combinePlugins(
  name: string,
  version: string,
  plugins: MCPKitPlugin[],
): MCPKitPlugin {
  return {
    name,
    version,
    description: `Combined plugin: ${plugins.map((p) => p.name).join(', ')}`,

    async onRegister(ctx) {
      for (const plugin of plugins) {
        // Register middleware
        if (plugin.middleware) {
          for (const mw of plugin.middleware) {
            ctx.useMiddleware(mw);
          }
        }

        // Register hooks
        if (plugin.hooks) {
          ctx.useHooks(plugin.hooks);
        }

        // Call plugin's onRegister
        if (plugin.onRegister) {
          await plugin.onRegister(ctx);
        }
      }
    },

    async onBeforeStart(ctx) {
      for (const plugin of plugins) {
        if (plugin.onBeforeStart) {
          await plugin.onBeforeStart(ctx);
        }
      }
    },

    async onServerStart(ctx, server) {
      for (const plugin of plugins) {
        if (plugin.onServerStart) {
          await plugin.onServerStart(ctx, server);
        }
      }
    },

    async onServerStop(ctx) {
      for (const plugin of plugins.reverse()) {
        if (plugin.onServerStop) {
          await plugin.onServerStop(ctx);
        }
      }
    },

    get api() {
      // Merge all plugin APIs
      const merged: Record<string, unknown> = {};
      for (const plugin of plugins) {
        if (plugin.api) {
          Object.assign(merged, { [plugin.name]: plugin.api });
        }
      }
      return merged;
    },
  };
}

/**
 * Create a middleware-only plugin
 */
export function middlewarePlugin(name: string, ...middleware: Middleware[]): MCPKitPlugin {
  return {
    name,
    version: '1.0.0',
    middleware,
  };
}

/**
 * Create a hooks-only plugin
 */
export function hooksPlugin(name: string, hooks: Partial<ServerHooks>): MCPKitPlugin {
  return {
    name,
    version: '1.0.0',
    hooks,
  };
}
