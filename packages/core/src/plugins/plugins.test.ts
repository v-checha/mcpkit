/**
 * Plugin system tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Middleware } from '../middleware/types.js';
import type { ServerHooks } from '../types/hooks.js';
import {
  combinePlugins,
  createPlugin,
  definePlugin,
  hooksPlugin,
  middlewarePlugin,
} from './helpers.js';
import { createPluginRegistry } from './registry.js';
import type { MCPKitPlugin, PluginContext } from './types.js';

describe('Plugin System', () => {
  describe('createPlugin', () => {
    it('should create a simple plugin with name and version', () => {
      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
      });

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should create a plugin with description', () => {
      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
      });

      expect(plugin.description).toBe('A test plugin');
    });

    it('should create a plugin with middleware', () => {
      const middleware: Middleware = async (_ctx, next) => {
        await next();
      };

      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        middleware,
      });

      expect(plugin.middleware).toHaveLength(1);
      expect(plugin.middleware?.[0]).toBe(middleware);
    });

    it('should create a plugin with multiple middleware', () => {
      const mw1: Middleware = async (_ctx, next) => await next();
      const mw2: Middleware = async (_ctx, next) => await next();

      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        middleware: [mw1, mw2],
      });

      expect(plugin.middleware).toHaveLength(2);
    });

    it('should create a plugin with hooks', () => {
      const hooks: Partial<ServerHooks> = {
        onToolCall: vi.fn(),
        onToolSuccess: vi.fn(),
      };

      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        hooks,
      });

      expect(plugin.hooks).toBe(hooks);
    });
  });

  describe('definePlugin', () => {
    it('should create a configurable plugin factory', () => {
      interface Options {
        prefix: string;
      }

      const factory = definePlugin<Options>({
        name: 'configurable-plugin',
        version: '1.0.0',
        setup: (options, ctx) => {
          ctx.state.set('prefix', options.prefix);
        },
      });

      const plugin = factory({ prefix: 'test' });

      expect(plugin.name).toBe('configurable-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.onRegister).toBe('function');
    });

    it('should allow plugin to return an API', async () => {
      interface Api {
        getValue: () => number;
      }

      const factory = definePlugin<void, Api>({
        name: 'api-plugin',
        version: '1.0.0',
        setup: () => ({
          getValue: () => 42,
        }),
      });

      const plugin = factory();

      // Simulate registration
      const mockContext: PluginContext = {
        serverName: 'test',
        serverVersion: '1.0.0',
        useMiddleware: vi.fn(),
        useHooks: vi.fn(),
        getPlugin: vi.fn(),
        log: vi.fn(),
        state: new Map(),
      };

      await plugin.onRegister?.(mockContext);

      expect(plugin.api).toBeDefined();
      expect((plugin.api as Api).getValue()).toBe(42);
    });

    it('should support dependencies', () => {
      const factory = definePlugin({
        name: 'dependent-plugin',
        version: '1.0.0',
        dependencies: ['base-plugin'],
        setup: () => {},
      });

      const plugin = factory();

      expect(plugin.dependencies).toEqual(['base-plugin']);
    });
  });

  describe('combinePlugins', () => {
    it('should combine multiple plugins into one', () => {
      const plugin1 = createPlugin({ name: 'p1', version: '1.0.0' });
      const plugin2 = createPlugin({ name: 'p2', version: '1.0.0' });

      const combined = combinePlugins('combined', '1.0.0', [plugin1, plugin2]);

      expect(combined.name).toBe('combined');
      expect(combined.version).toBe('1.0.0');
      expect(combined.description).toContain('p1');
      expect(combined.description).toContain('p2');
    });

    it('should call onRegister for all plugins', async () => {
      const onRegister1 = vi.fn();
      const onRegister2 = vi.fn();

      const plugin1: MCPKitPlugin = {
        name: 'p1',
        version: '1.0.0',
        onRegister: onRegister1,
      };

      const plugin2: MCPKitPlugin = {
        name: 'p2',
        version: '1.0.0',
        onRegister: onRegister2,
      };

      const combined = combinePlugins('combined', '1.0.0', [plugin1, plugin2]);

      const mockContext: PluginContext = {
        serverName: 'test',
        serverVersion: '1.0.0',
        useMiddleware: vi.fn(),
        useHooks: vi.fn(),
        getPlugin: vi.fn(),
        log: vi.fn(),
        state: new Map(),
      };

      await combined.onRegister?.(mockContext);

      expect(onRegister1).toHaveBeenCalledWith(mockContext);
      expect(onRegister2).toHaveBeenCalledWith(mockContext);
    });

    it('should merge middleware from all plugins', async () => {
      const mw1: Middleware = async (_ctx, next) => await next();
      const mw2: Middleware = async (_ctx, next) => await next();

      const plugin1 = createPlugin({ name: 'p1', version: '1.0.0', middleware: mw1 });
      const plugin2 = createPlugin({ name: 'p2', version: '1.0.0', middleware: mw2 });

      const combined = combinePlugins('combined', '1.0.0', [plugin1, plugin2]);

      const usedMiddleware: Middleware[] = [];
      const mockContext: PluginContext = {
        serverName: 'test',
        serverVersion: '1.0.0',
        useMiddleware: (m) => usedMiddleware.push(m),
        useHooks: vi.fn(),
        getPlugin: vi.fn(),
        log: vi.fn(),
        state: new Map(),
      };

      await combined.onRegister?.(mockContext);

      expect(usedMiddleware).toHaveLength(2);
    });

    it('should merge hooks from all plugins', async () => {
      const hooks1: Partial<ServerHooks> = { onToolCall: vi.fn() };
      const hooks2: Partial<ServerHooks> = { onToolSuccess: vi.fn() };

      const plugin1 = createPlugin({ name: 'p1', version: '1.0.0', hooks: hooks1 });
      const plugin2 = createPlugin({ name: 'p2', version: '1.0.0', hooks: hooks2 });

      const combined = combinePlugins('combined', '1.0.0', [plugin1, plugin2]);

      const usedHooks: Partial<ServerHooks>[] = [];
      const mockContext: PluginContext = {
        serverName: 'test',
        serverVersion: '1.0.0',
        useMiddleware: vi.fn(),
        useHooks: (h) => usedHooks.push(h),
        getPlugin: vi.fn(),
        log: vi.fn(),
        state: new Map(),
      };

      await combined.onRegister?.(mockContext);

      expect(usedHooks).toHaveLength(2);
    });
  });

  describe('middlewarePlugin', () => {
    it('should create a middleware-only plugin', () => {
      const mw: Middleware = async (_ctx, next) => await next();
      const plugin = middlewarePlugin('mw-plugin', mw);

      expect(plugin.name).toBe('mw-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.middleware).toHaveLength(1);
    });

    it('should accept multiple middleware', () => {
      const mw1: Middleware = async (_ctx, next) => await next();
      const mw2: Middleware = async (_ctx, next) => await next();
      const plugin = middlewarePlugin('mw-plugin', mw1, mw2);

      expect(plugin.middleware).toHaveLength(2);
    });
  });

  describe('hooksPlugin', () => {
    it('should create a hooks-only plugin', () => {
      const hooks: Partial<ServerHooks> = {
        onToolCall: vi.fn(),
      };
      const plugin = hooksPlugin('hooks-plugin', hooks);

      expect(plugin.name).toBe('hooks-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.hooks).toBe(hooks);
    });
  });

  describe('PluginRegistry', () => {
    it('should register a plugin', () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const plugin = createPlugin({ name: 'test', version: '1.0.0' });

      registry.register(plugin);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')?.plugin).toBe(plugin);
    });

    it('should register a plugin factory', () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const factory = definePlugin({
        name: 'factory-plugin',
        version: '1.0.0',
        setup: () => {},
      });

      registry.register(factory);

      expect(registry.has('factory-plugin')).toBe(true);
    });

    it('should throw on duplicate plugin names', () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const plugin = createPlugin({ name: 'test', version: '1.0.0' });

      registry.register(plugin);

      expect(() => registry.register(plugin)).toThrow('already registered');
    });

    it('should return all registered plugins', () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const p1 = createPlugin({ name: 'p1', version: '1.0.0' });
      const p2 = createPlugin({ name: 'p2', version: '1.0.0' });

      registry.register(p1);
      registry.register(p2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should initialize plugins in registration order', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const order: string[] = [];

      const p1: MCPKitPlugin = {
        name: 'p1',
        version: '1.0.0',
        onRegister: () => { order.push('p1'); },
      };

      const p2: MCPKitPlugin = {
        name: 'p2',
        version: '1.0.0',
        onRegister: () => { order.push('p2'); },
      };

      registry.register(p1);
      registry.register(p2);

      await registry.initializeAll();

      expect(order).toEqual(['p1', 'p2']);
    });

    it('should resolve dependencies correctly', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const order: string[] = [];

      const base: MCPKitPlugin = {
        name: 'base',
        version: '1.0.0',
        onRegister: () => { order.push('base'); },
      };

      const dependent: MCPKitPlugin = {
        name: 'dependent',
        version: '1.0.0',
        dependencies: ['base'],
        onRegister: () => { order.push('dependent'); },
      };

      // Register in reverse order
      registry.register(dependent);
      registry.register(base);

      await registry.initializeAll();

      expect(order).toEqual(['base', 'dependent']);
    });

    it('should detect circular dependencies', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');

      const p1: MCPKitPlugin = {
        name: 'p1',
        version: '1.0.0',
        dependencies: ['p2'],
      };

      const p2: MCPKitPlugin = {
        name: 'p2',
        version: '1.0.0',
        dependencies: ['p1'],
      };

      registry.register(p1);
      registry.register(p2);

      await expect(registry.initializeAll()).rejects.toThrow('Circular dependency');
    });

    it('should throw on missing dependencies', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');

      const plugin: MCPKitPlugin = {
        name: 'plugin',
        version: '1.0.0',
        dependencies: ['missing'],
      };

      registry.register(plugin);

      await expect(registry.initializeAll()).rejects.toThrow('not registered');
    });

    it('should collect middleware from plugins', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const mw: Middleware = async (_ctx, next) => await next();

      const plugin = createPlugin({
        name: 'mw-plugin',
        version: '1.0.0',
        middleware: mw,
      });

      registry.register(plugin);
      await registry.initializeAll();

      expect(registry.getMiddlewares()).toHaveLength(1);
    });

    it('should collect hooks from plugins', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const hooks: Partial<ServerHooks> = {
        onToolCall: vi.fn(),
      };

      const plugin = createPlugin({
        name: 'hooks-plugin',
        version: '1.0.0',
        hooks,
      });

      registry.register(plugin);
      await registry.initializeAll();

      expect(registry.getHooks()).toHaveLength(1);
    });

    it('should provide plugin context during registration', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      let capturedContext: PluginContext | undefined;

      const plugin: MCPKitPlugin = {
        name: 'context-test',
        version: '1.0.0',
        onRegister: (ctx) => {
          capturedContext = ctx;
        },
      };

      registry.register(plugin);
      await registry.initializeAll();

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.serverName).toBe('test-server');
      expect(capturedContext?.serverVersion).toBe('1.0.0');
      expect(typeof capturedContext?.useMiddleware).toBe('function');
      expect(typeof capturedContext?.useHooks).toBe('function');
      expect(typeof capturedContext?.getPlugin).toBe('function');
      expect(typeof capturedContext?.log).toBe('function');
      expect(capturedContext?.state).toBeInstanceOf(Map);
    });

    it('should allow plugins to use context.useMiddleware', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const mw: Middleware = async (_ctx, next) => await next();

      const plugin: MCPKitPlugin = {
        name: 'dynamic-mw',
        version: '1.0.0',
        onRegister: (ctx) => {
          ctx.useMiddleware(mw);
        },
      };

      registry.register(plugin);
      await registry.initializeAll();

      expect(registry.getMiddlewares()).toHaveLength(1);
    });

    it('should allow plugins to use context.useHooks', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');

      const plugin: MCPKitPlugin = {
        name: 'dynamic-hooks',
        version: '1.0.0',
        onRegister: (ctx) => {
          ctx.useHooks({
            onToolCall: vi.fn(),
          });
        },
      };

      registry.register(plugin);
      await registry.initializeAll();

      expect(registry.getHooks()).toHaveLength(1);
    });

    it('should allow plugins to access other plugins via getPlugin', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');

      interface BaseApi {
        getValue: () => number;
      }

      const baseFactory = definePlugin<void, BaseApi>({
        name: 'base',
        version: '1.0.0',
        setup: () => ({
          getValue: () => 42,
        }),
      });

      let retrievedValue: number | undefined;

      const dependentFactory = definePlugin({
        name: 'dependent',
        version: '1.0.0',
        dependencies: ['base'],
        setup: (_opts, ctx) => {
          const baseApi = ctx.getPlugin<BaseApi>('base');
          retrievedValue = baseApi?.getValue();
        },
      });

      registry.register(baseFactory);
      registry.register(dependentFactory);
      await registry.initializeAll();

      expect(retrievedValue).toBe(42);
    });

    it('should call onBeforeStart for all plugins', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const beforeStart = vi.fn();

      const plugin: MCPKitPlugin = {
        name: 'test',
        version: '1.0.0',
        onBeforeStart: beforeStart,
      };

      registry.register(plugin);
      await registry.initializeAll();

      expect(beforeStart).toHaveBeenCalled();
    });

    it('should call onServerStart for all plugins when started', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const serverStart = vi.fn();

      const plugin: MCPKitPlugin = {
        name: 'test',
        version: '1.0.0',
        onServerStart: serverStart,
      };

      registry.register(plugin);
      await registry.initializeAll();

      // Mock MCP server
      const mockServer = {} as import('@modelcontextprotocol/sdk/server/mcp.js').McpServer;
      await registry.startAll(mockServer);

      expect(serverStart).toHaveBeenCalled();
    });

    it('should call onServerStop for all plugins when stopped', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const serverStop = vi.fn();

      const plugin: MCPKitPlugin = {
        name: 'test',
        version: '1.0.0',
        onServerStop: serverStop,
      };

      registry.register(plugin);
      await registry.initializeAll();
      await registry.stopAll();

      expect(serverStop).toHaveBeenCalled();
    });

    it('should stop plugins in reverse dependency order', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const order: string[] = [];

      const base: MCPKitPlugin = {
        name: 'base',
        version: '1.0.0',
        onServerStop: () => { order.push('base'); },
      };

      const dependent: MCPKitPlugin = {
        name: 'dependent',
        version: '1.0.0',
        dependencies: ['base'],
        onServerStop: () => { order.push('dependent'); },
      };

      registry.register(base);
      registry.register(dependent);

      await registry.initializeAll();
      await registry.stopAll();

      // Dependent should stop before base
      expect(order).toEqual(['dependent', 'base']);
    });

    it('should handle errors during initialization', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const onError = vi.fn();

      const plugin: MCPKitPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        onRegister: () => {
          throw new Error('Init failed');
        },
        onError,
      };

      registry.register(plugin);

      await expect(registry.initializeAll()).rejects.toThrow('Failed to initialize plugin');
      expect(onError).toHaveBeenCalled();
    });

    it('should continue stopping plugins even if one fails', async () => {
      const registry = createPluginRegistry('test-server', '1.0.0');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const p2Stop = vi.fn();

      const p1: MCPKitPlugin = {
        name: 'p1',
        version: '1.0.0',
        onServerStop: () => {
          throw new Error('Stop failed');
        },
      };

      const p2: MCPKitPlugin = {
        name: 'p2',
        version: '1.0.0',
        onServerStop: p2Stop,
      };

      registry.register(p1);
      registry.register(p2);

      await registry.initializeAll();
      await registry.stopAll();

      // p2 should still have been stopped
      expect(p2Stop).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
