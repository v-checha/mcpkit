/**
 * Plugin system types for MCPKit
 *
 * Enables community extensions and modular functionality.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Middleware } from '../middleware/types.js';
import type { ServerHooks } from '../types/hooks.js';

/**
 * Plugin metadata
 */
export interface PluginMeta {
  /**
   * Unique plugin name
   */
  name: string;

  /**
   * Plugin version (semver)
   */
  version: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Plugin author
   */
  author?: string;

  /**
   * Plugin dependencies (other plugin names)
   */
  dependencies?: string[];
}

/**
 * Plugin context provided during registration
 */
export interface PluginContext {
  /**
   * Server name
   */
  serverName: string;

  /**
   * Server version
   */
  serverVersion: string;

  /**
   * Server instance (available after bootstrap)
   */
  server?: McpServer;

  /**
   * Register a middleware
   */
  useMiddleware(middleware: Middleware): void;

  /**
   * Register hooks
   */
  useHooks(hooks: Partial<ServerHooks>): void;

  /**
   * Get another plugin's API
   */
  getPlugin<T = unknown>(name: string): T | undefined;

  /**
   * Log a message
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;

  /**
   * Store plugin-specific state
   */
  state: Map<string, unknown>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /**
   * Called when plugin is registered (before server starts)
   * Use this to register middleware, hooks, and initialize state
   */
  onRegister?(context: PluginContext): void | Promise<void>;

  /**
   * Called after all plugins are registered but before server starts
   */
  onBeforeStart?(context: PluginContext): void | Promise<void>;

  /**
   * Called after the server has started
   */
  onServerStart?(context: PluginContext, server: McpServer): void | Promise<void>;

  /**
   * Called when the server is shutting down
   */
  onServerStop?(context: PluginContext): void | Promise<void>;

  /**
   * Called when an error occurs in the plugin
   */
  onError?(context: PluginContext, error: Error): void | Promise<void>;
}

/**
 * Plugin public API
 * Plugins can expose an API for other plugins to use
 */
export interface PluginApi {
  [key: string]: unknown;
}

/**
 * MCPKit Plugin interface
 *
 * @example
 * ```typescript
 * const myPlugin: MCPKitPlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *
 *   onRegister(ctx) {
 *     ctx.useMiddleware(myMiddleware);
 *     ctx.useHooks({
 *       onToolCall: async (context) => {
 *         ctx.log('info', `Tool called: ${context.name}`);
 *       },
 *     });
 *   },
 *
 *   api: {
 *     getStats: () => ({ calls: 100 }),
 *   },
 * };
 * ```
 */
export interface MCPKitPlugin extends PluginMeta, PluginLifecycle {
  /**
   * Public API exposed to other plugins
   */
  api?: PluginApi;

  /**
   * Middleware to be registered
   * Alternative to using ctx.useMiddleware in onRegister
   */
  middleware?: Middleware[];

  /**
   * Hooks to be registered
   * Alternative to using ctx.useHooks in onRegister
   */
  hooks?: Partial<ServerHooks>;
}

/**
 * Plugin factory function type
 * Allows plugins to be configured before use
 */
export type PluginFactory<TOptions = unknown> = (options?: TOptions) => MCPKitPlugin;

/**
 * Plugin input - either a plugin instance or a factory
 */
export type PluginInput = MCPKitPlugin | PluginFactory;

/**
 * Resolved plugin with context
 */
export interface ResolvedPlugin {
  /**
   * The plugin instance
   */
  plugin: MCPKitPlugin;

  /**
   * Plugin context
   */
  context: PluginContext;

  /**
   * Whether the plugin has been initialized
   */
  initialized: boolean;
}

/**
 * Plugin registry for managing plugins
 */
export interface PluginRegistry {
  /**
   * Register a plugin
   */
  register(plugin: PluginInput): void;

  /**
   * Get a registered plugin by name
   */
  get(name: string): ResolvedPlugin | undefined;

  /**
   * Get all registered plugins
   */
  getAll(): ResolvedPlugin[];

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean;

  /**
   * Initialize all plugins
   */
  initializeAll(): Promise<void>;

  /**
   * Start all plugins
   */
  startAll(server: McpServer): Promise<void>;

  /**
   * Stop all plugins
   */
  stopAll(): Promise<void>;
}
