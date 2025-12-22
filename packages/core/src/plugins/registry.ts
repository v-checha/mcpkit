/**
 * Plugin registry implementation
 *
 * Manages plugin lifecycle, dependency resolution, and API access.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Middleware } from '../middleware/types.js';
import type { ServerHooks } from '../types/hooks.js';
import type {
  MCPKitPlugin,
  PluginContext,
  PluginInput,
  PluginRegistry,
  ResolvedPlugin,
} from './types.js';

/**
 * Create a plugin context for a specific plugin
 */
function createPluginContext(
  plugin: MCPKitPlugin,
  serverName: string,
  serverVersion: string,
  registry: PluginRegistryImpl,
): PluginContext {
  const middlewares: Middleware[] = [];
  const hooks: Partial<ServerHooks>[] = [];
  const state = new Map<string, unknown>();

  return {
    serverName,
    serverVersion,

    useMiddleware(middleware: Middleware): void {
      middlewares.push(middleware);
    },

    useHooks(newHooks: Partial<ServerHooks>): void {
      hooks.push(newHooks);
    },

    getPlugin<T = unknown>(name: string): T | undefined {
      const resolved = registry.get(name);
      if (resolved?.plugin.api) {
        return resolved.plugin.api as T;
      }
      return undefined;
    },

    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
      const prefix = `[${plugin.name}]`;
      switch (level) {
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'error':
          console.error(prefix, message);
          break;
      }
    },

    state,

    // Internal: access collected middleware/hooks
    get _middlewares() {
      return middlewares;
    },
    get _hooks() {
      return hooks;
    },
  } as PluginContext & { _middlewares: Middleware[]; _hooks: Partial<ServerHooks>[] };
}

/**
 * Plugin registry implementation
 */
export class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, ResolvedPlugin> = new Map();
  private serverName: string;
  private serverVersion: string;
  private allMiddlewares: Middleware[] = [];
  private allHooks: Partial<ServerHooks>[] = [];

  constructor(serverName: string, serverVersion: string) {
    this.serverName = serverName;
    this.serverVersion = serverVersion;
  }

  /**
   * Register a plugin
   */
  register(input: PluginInput): void {
    // Resolve plugin if it's a factory
    const plugin = typeof input === 'function' ? input() : input;

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }

    const context = createPluginContext(
      plugin,
      this.serverName,
      this.serverVersion,
      this,
    );

    this.plugins.set(plugin.name, {
      plugin,
      context,
      initialized: false,
    });
  }

  /**
   * Get a registered plugin by name
   */
  get(name: string): ResolvedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAll(): ResolvedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all collected middlewares from plugins
   */
  getMiddlewares(): Middleware[] {
    return this.allMiddlewares;
  }

  /**
   * Get all collected hooks from plugins
   */
  getHooks(): Partial<ServerHooks>[] {
    return this.allHooks;
  }

  /**
   * Resolve plugin dependencies and return initialization order
   */
  private resolveOrder(): ResolvedPlugin[] {
    const resolved: ResolvedPlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      const entry = this.plugins.get(name);
      if (!entry) {
        throw new Error(`Plugin not found: ${name}`);
      }

      visiting.add(name);

      // Visit dependencies first
      const deps = entry.plugin.dependencies ?? [];
      for (const dep of deps) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin "${name}" depends on "${dep}" which is not registered`,
          );
        }
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      resolved.push(entry);
    };

    for (const name of this.plugins.keys()) {
      visit(name);
    }

    return resolved;
  }

  /**
   * Initialize all plugins in dependency order
   */
  async initializeAll(): Promise<void> {
    const ordered = this.resolveOrder();

    for (const entry of ordered) {
      if (entry.initialized) continue;

      const { plugin, context } = entry;

      try {
        // Register inline middleware
        if (plugin.middleware) {
          for (const mw of plugin.middleware) {
            (context as PluginContext & { _middlewares: Middleware[] })._middlewares.push(mw);
          }
        }

        // Register inline hooks
        if (plugin.hooks) {
          (context as PluginContext & { _hooks: Partial<ServerHooks>[] })._hooks.push(plugin.hooks);
        }

        // Call onRegister
        if (plugin.onRegister) {
          await plugin.onRegister(context);
        }

        // Collect middleware and hooks
        const ctx = context as PluginContext & {
          _middlewares: Middleware[];
          _hooks: Partial<ServerHooks>[];
        };
        this.allMiddlewares.push(...ctx._middlewares);
        this.allHooks.push(...ctx._hooks);

        entry.initialized = true;
      } catch (error) {
        if (plugin.onError) {
          await plugin.onError(context, error instanceof Error ? error : new Error(String(error)));
        }
        throw new Error(
          `Failed to initialize plugin "${plugin.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Call onBeforeStart for all plugins
    for (const entry of ordered) {
      const { plugin, context } = entry;
      if (plugin.onBeforeStart) {
        await plugin.onBeforeStart(context);
      }
    }
  }

  /**
   * Start all plugins
   */
  async startAll(server: McpServer): Promise<void> {
    for (const entry of this.plugins.values()) {
      const { plugin, context } = entry;

      // Update context with server
      (context as { server?: McpServer }).server = server;

      if (plugin.onServerStart) {
        try {
          await plugin.onServerStart(context, server);
        } catch (error) {
          if (plugin.onError) {
            await plugin.onError(context, error instanceof Error ? error : new Error(String(error)));
          }
          throw error;
        }
      }
    }
  }

  /**
   * Stop all plugins (in reverse order)
   */
  async stopAll(): Promise<void> {
    const ordered = this.resolveOrder().reverse();

    for (const entry of ordered) {
      const { plugin, context } = entry;

      if (plugin.onServerStop) {
        try {
          await plugin.onServerStop(context);
        } catch (error) {
          // Log but don't throw during shutdown
          console.error(`Error stopping plugin "${plugin.name}":`, error);
        }
      }
    }
  }
}

/**
 * Create a new plugin registry
 */
export function createPluginRegistry(
  serverName: string,
  serverVersion: string,
): PluginRegistryImpl {
  return new PluginRegistryImpl(serverName, serverVersion);
}
