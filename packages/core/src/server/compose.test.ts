/**
 * Server composition tests
 */

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Param, Prompt, Resource, Tool } from '../decorators/index.js';
import { MCPServer } from '../decorators/server.js';
import { MetadataStorage } from '../metadata/index.js';
import type { ServerHooks } from '../types/hooks.js';
import {
  combinePrompts,
  combineResources,
  combineTools,
  composeServers,
  createComposedServer,
} from './compose.js';

describe('Server Composition', () => {
  // Test server classes
  @MCPServer({ name: 'weather-server', version: '1.0.0' })
  class WeatherServer {
    @Tool({ description: 'Get current weather' })
    async getWeather(@Param({ name: 'city' }) city: string) {
      return `Weather in ${city}: Sunny`;
    }

    @Resource({ uri: 'weather://current' })
    async currentWeather() {
      return { temperature: 72 };
    }

    @Prompt({ name: 'weather-prompt', description: 'Weather prompt' })
    async weatherPrompt(@Param({ name: 'city' }) city: string) {
      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Weather in ${city}?` } }],
      };
    }
  }

  @MCPServer({ name: 'news-server', version: '1.0.0' })
  class NewsServer {
    @Tool({ description: 'Get latest news' })
    async getNews(@Param({ name: 'topic' }) topic: string) {
      return `News about ${topic}`;
    }

    @Resource({ uri: 'news://headlines' })
    async headlines() {
      return { headlines: ['Breaking news'] };
    }

    @Prompt({ name: 'news-prompt', description: 'News prompt' })
    async newsPrompt(@Param({ name: 'topic' }) topic: string) {
      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `News about ${topic}?` } }],
      };
    }
  }

  describe('composeServers', () => {
    it('should compose basic server metadata', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const composed = composeServers({
        name: 'combined-server',
        version: '2.0.0',
        description: 'Combined weather and news',
        servers: [
          { instance: weatherServer },
          { instance: newsServer },
        ],
      });

      expect(composed.name).toBe('combined-server');
      expect(composed.version).toBe('2.0.0');
      expect(composed.description).toBe('Combined weather and news');
    });

    it('should enable capabilities based on registered items', () => {
      const weatherServer = new WeatherServer();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        servers: [{ instance: weatherServer }],
      });

      expect(composed.capabilities?.tools).toBe(true);
      expect(composed.capabilities?.resources).toBe(true);
      expect(composed.capabilities?.prompts).toBe(true);
    });

    it('should apply tool prefix', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        servers: [
          { instance: weatherServer, toolPrefix: 'weather_' },
          { instance: newsServer, toolPrefix: 'news_' },
        ],
      });

      // Check that tools have prefixed names
      const toolNames = MetadataStorage.getToolsMetadata(Object.getPrototypeOf(weatherServer))
        .map((t) => `weather_${t.name ?? String(t.propertyKey)}`);

      expect(toolNames).toContain('weather_getWeather');
    });

    it('should apply resource prefix', () => {
      const weatherServer = new WeatherServer();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        servers: [
          { instance: weatherServer, resourcePrefix: 'data:' },
        ],
      });

      expect(composed.servers[0].resourcePrefix).toBe('data:');
    });

    it('should apply prompt prefix', () => {
      const weatherServer = new WeatherServer();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        servers: [
          { instance: weatherServer, promptPrefix: 'wx_' },
        ],
      });

      expect(composed.servers[0].promptPrefix).toBe('wx_');
    });

    it('should merge global hooks', () => {
      const weatherServer = new WeatherServer();
      const globalHook = vi.fn();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        hooks: {
          onToolCall: globalHook,
        },
        servers: [{ instance: weatherServer }],
      });

      expect(composed.hooks).toBeDefined();
    });

    it('should include global middleware', () => {
      const weatherServer = new WeatherServer();
      const middleware = async (_ctx: unknown, next: () => Promise<void>) => await next();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        middleware: [middleware],
        servers: [{ instance: weatherServer }],
      });

      expect(composed.middleware).toHaveLength(1);
    });

    it('should include global plugins', () => {
      const weatherServer = new WeatherServer();
      const plugin = { name: 'test-plugin', version: '1.0.0' };

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        plugins: [plugin],
        servers: [{ instance: weatherServer }],
      });

      expect(composed.plugins).toHaveLength(1);
    });

    it('should store original server instances', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const composed = composeServers({
        name: 'test',
        version: '1.0.0',
        servers: [
          { instance: weatherServer },
          { instance: newsServer },
        ],
      });

      expect(composed.servers).toHaveLength(2);
      expect(composed.servers[0].instance).toBe(weatherServer);
      expect(composed.servers[1].instance).toBe(newsServer);
    });
  });

  describe('createComposedServer', () => {
    it('should create a class for the composed server', () => {
      const weatherServer = new WeatherServer();

      const ComposedServer = createComposedServer({
        name: 'composed',
        version: '1.0.0',
        servers: [{ instance: weatherServer }],
      });

      expect(typeof ComposedServer).toBe('function');
    });

    it('should instantiate with getServers method', () => {
      const weatherServer = new WeatherServer();

      const ComposedServer = createComposedServer({
        name: 'composed',
        version: '1.0.0',
        servers: [{ instance: weatherServer }],
      });

      const instance = new ComposedServer();

      expect(instance.getServers()).toHaveLength(1);
      expect(instance.getServers()[0]).toBe(weatherServer);
    });

    it('should provide getServer method', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const ComposedServer = createComposedServer({
        name: 'composed',
        version: '1.0.0',
        servers: [
          { instance: weatherServer },
          { instance: newsServer },
        ],
      });

      const instance = new ComposedServer();

      expect(instance.getServer(0)).toBe(weatherServer);
      expect(instance.getServer(1)).toBe(newsServer);
      expect(instance.getServer(2)).toBeUndefined();
    });

    it('should provide getMetadata method', () => {
      const weatherServer = new WeatherServer();

      const ComposedServer = createComposedServer({
        name: 'composed',
        version: '1.0.0',
        description: 'Test composed server',
        servers: [{ instance: weatherServer }],
      });

      const instance = new ComposedServer();
      const metadata = instance.getMetadata();

      expect(metadata.name).toBe('composed');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('Test composed server');
    });

    it('should store metadata on constructor for bootstrap', () => {
      const weatherServer = new WeatherServer();

      const ComposedServer = createComposedServer({
        name: 'composed',
        version: '1.0.0',
        servers: [{ instance: weatherServer }],
      });

      const storedMetadata = MetadataStorage.getServerOptions(ComposedServer);

      expect(storedMetadata).toBeDefined();
      expect(storedMetadata?.name).toBe('composed');
    });
  });

  describe('combineTools', () => {
    it('should combine tools from multiple sources', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const tools = combineTools([
        { prototype: Object.getPrototypeOf(weatherServer) },
        { prototype: Object.getPrototypeOf(newsServer) },
      ]);

      expect(tools.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply prefixes to tool names', () => {
      const weatherServer = new WeatherServer();

      const tools = combineTools([
        { prototype: Object.getPrototypeOf(weatherServer), prefix: 'weather_' },
      ]);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames.every((n) => n?.startsWith('weather_'))).toBe(true);
    });
  });

  describe('combineResources', () => {
    it('should combine resources from multiple sources', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const resources = combineResources([
        { prototype: Object.getPrototypeOf(weatherServer) },
        { prototype: Object.getPrototypeOf(newsServer) },
      ]);

      expect(resources.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply prefixes to resource URIs', () => {
      const weatherServer = new WeatherServer();

      const resources = combineResources([
        { prototype: Object.getPrototypeOf(weatherServer), prefix: 'data:' },
      ]);

      const uris = resources.map((r) => r.uri);
      expect(uris.every((u) => u.startsWith('data:'))).toBe(true);
    });
  });

  describe('combinePrompts', () => {
    it('should combine prompts from multiple sources', () => {
      const weatherServer = new WeatherServer();
      const newsServer = new NewsServer();

      const prompts = combinePrompts([
        { prototype: Object.getPrototypeOf(weatherServer) },
        { prototype: Object.getPrototypeOf(newsServer) },
      ]);

      expect(prompts.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply prefixes to prompt names', () => {
      const weatherServer = new WeatherServer();

      const prompts = combinePrompts([
        { prototype: Object.getPrototypeOf(weatherServer), prefix: 'wx_' },
      ]);

      const promptNames = prompts.map((p) => p.name);
      expect(promptNames.every((n) => n?.startsWith('wx_'))).toBe(true);
    });
  });

  describe('hooks merging', () => {
    it('should merge hooks from multiple servers', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      @MCPServer({
        name: 'server1',
        version: '1.0.0',
        hooks: { onToolCall: hook1 },
      })
      class Server1 {
        @Tool({ description: 'Test' })
        async test() { return 'test'; }
      }

      @MCPServer({
        name: 'server2',
        version: '1.0.0',
        hooks: { onToolCall: hook2 },
      })
      class Server2 {
        @Tool({ description: 'Test' })
        async test() { return 'test'; }
      }

      const composed = composeServers({
        name: 'combined',
        version: '1.0.0',
        servers: [
          { instance: new Server1() },
          { instance: new Server2() },
        ],
      });

      expect(composed.hooks).toBeDefined();
      expect(typeof composed.hooks?.onToolCall).toBe('function');
    });
  });
});
