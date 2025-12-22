/**
 * Tests for MCP Gateway
 */

import { describe, expect, it, vi } from 'vitest';
import { createGateway, type GatewayOptions, MCPGateway } from './gateway.js';

describe('MCPGateway', () => {
  const createTestOptions = (overrides: Partial<GatewayOptions> = {}): GatewayOptions => ({
    name: 'test-gateway',
    version: '1.0.0',
    upstreams: [
      { url: 'http://server1:3000', toolPrefix: 'server1_' },
      { url: 'http://server2:3000', toolPrefix: 'server2_' },
    ],
    healthCheck: false, // Disable by default for tests
    ...overrides,
  });

  describe('createGateway', () => {
    it('should create a gateway instance', () => {
      const gateway = createGateway(createTestOptions());
      expect(gateway).toBeInstanceOf(MCPGateway);
    });

    it('should use default options', () => {
      const gateway = createGateway(createTestOptions());
      const options = gateway.getOptions();

      expect(options.loadBalancing).toBe('round-robin');
      expect(options.timeout).toBe(30000);
    });
  });

  describe('upstreams', () => {
    it('should return all upstreams', () => {
      const gateway = createGateway(createTestOptions());
      const upstreams = gateway.getUpstreams();

      expect(upstreams).toHaveLength(2);
      expect(upstreams[0].url).toBe('http://server1:3000');
      expect(upstreams[1].url).toBe('http://server2:3000');
    });

    it('should get upstream health', () => {
      const gateway = createGateway(createTestOptions());
      const health = gateway.getUpstreamHealth();

      expect(health).toHaveLength(2);
      expect(health[0].healthy).toBe(true);
      expect(health[0].circuitState).toBe('closed');
    });

    it('should get specific upstream health by URL', () => {
      const gateway = createGateway(createTestOptions());
      const health = gateway.getUpstreamHealthByUrl('http://server1:3000');

      expect(health).toBeDefined();
      expect(health?.upstream.url).toBe('http://server1:3000');
    });
  });

  describe('load balancing', () => {
    it('should use round-robin by default', () => {
      const gateway = createGateway(createTestOptions());

      // Select multiple times and check distribution
      const selected: string[] = [];
      for (let i = 0; i < 4; i++) {
        const upstream = gateway.selectUpstream();
        selected.push(upstream?.url ?? '');
      }

      // Should alternate between servers
      expect(selected[0]).toBe('http://server1:3000');
      expect(selected[1]).toBe('http://server2:3000');
      expect(selected[2]).toBe('http://server1:3000');
      expect(selected[3]).toBe('http://server2:3000');
    });

    it('should use random load balancing', () => {
      const gateway = createGateway(createTestOptions({ loadBalancing: 'random' }));

      // Just verify it returns a valid upstream
      const upstream = gateway.selectUpstream();
      expect(upstream).toBeDefined();
      expect(['http://server1:3000', 'http://server2:3000']).toContain(upstream?.url);
    });

    it('should use weighted load balancing', () => {
      const gateway = createGateway(
        createTestOptions({
          loadBalancing: 'weighted',
          upstreams: [
            { url: 'http://heavy:3000', weight: 10 },
            { url: 'http://light:3000', weight: 1 },
          ],
        }),
      );

      // Select many times and verify heavy is selected more often
      const counts: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        const upstream = gateway.selectUpstream();
        if (upstream) {
          counts[upstream.url] = (counts[upstream.url] ?? 0) + 1;
        }
      }

      // Heavy should be selected significantly more
      expect(counts['http://heavy:3000']).toBeGreaterThan(counts['http://light:3000'] * 2);
    });

    it('should use least-connections load balancing', () => {
      const gateway = createGateway(createTestOptions({ loadBalancing: 'least-connections' }));

      // Initially both have 0 connections, so it should select first
      const upstream = gateway.selectUpstream();
      expect(upstream).toBeDefined();
    });
  });

  describe('tool/resource/prompt routing', () => {
    it('should find upstream for prefixed tool', () => {
      const gateway = createGateway(createTestOptions());

      const upstream = gateway.findUpstreamForTool('server1_myTool');
      expect(upstream?.url).toBe('http://server1:3000');

      const upstream2 = gateway.findUpstreamForTool('server2_anotherTool');
      expect(upstream2?.url).toBe('http://server2:3000');
    });

    it('should find upstream for prefixed resource', () => {
      const gateway = createGateway(
        createTestOptions({
          upstreams: [
            { url: 'http://server1:3000', resourcePrefix: 'docs://' },
            { url: 'http://server2:3000', resourcePrefix: 'api://' },
          ],
        }),
      );

      const upstream = gateway.findUpstreamForResource('docs://readme');
      expect(upstream?.url).toBe('http://server1:3000');

      const upstream2 = gateway.findUpstreamForResource('api://users');
      expect(upstream2?.url).toBe('http://server2:3000');
    });

    it('should find upstream for prefixed prompt', () => {
      const gateway = createGateway(
        createTestOptions({
          upstreams: [
            { url: 'http://server1:3000', promptPrefix: 'writing_' },
            { url: 'http://server2:3000', promptPrefix: 'coding_' },
          ],
        }),
      );

      const upstream = gateway.findUpstreamForPrompt('writing_essay');
      expect(upstream?.url).toBe('http://server1:3000');
    });

    it('should use load balancing for unprefixed requests', () => {
      const gateway = createGateway(createTestOptions());

      // Tool without a matching prefix should use load balancing
      const upstream = gateway.findUpstreamForTool('unknownTool');
      expect(upstream).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start and stop gateway', async () => {
      const gateway = createGateway(createTestOptions());

      expect(gateway.isStarted()).toBe(false);
      await gateway.start();
      expect(gateway.isStarted()).toBe(true);
      await gateway.stop();
      expect(gateway.isStarted()).toBe(false);
    });

    it('should throw when starting twice', async () => {
      const gateway = createGateway(createTestOptions());

      await gateway.start();
      await expect(gateway.start()).rejects.toThrow('already started');
      await gateway.stop();
    });
  });

  describe('circuit breaker', () => {
    it('should use default circuit breaker config', () => {
      const gateway = createGateway(createTestOptions());
      const options = gateway.getOptions();

      expect(options.circuitBreaker?.failureThreshold).toBe(5);
      expect(options.circuitBreaker?.resetTimeout).toBe(30000);
    });

    it('should use custom circuit breaker config', () => {
      const gateway = createGateway(
        createTestOptions({
          circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 10000,
          },
        }),
      );

      const options = gateway.getOptions();
      expect(options.circuitBreaker?.failureThreshold).toBe(3);
      expect(options.circuitBreaker?.resetTimeout).toBe(10000);
    });
  });

  describe('callbacks', () => {
    it('should accept upstream callbacks', async () => {
      const onUnhealthy = vi.fn();
      const onRecovered = vi.fn();

      const gateway = createGateway(
        createTestOptions({
          onUpstreamUnhealthy: onUnhealthy,
          onUpstreamRecovered: onRecovered,
        }),
      );

      expect(gateway.getOptions().onUpstreamUnhealthy).toBe(onUnhealthy);
      expect(gateway.getOptions().onUpstreamRecovered).toBe(onRecovered);
    });
  });

  describe('tool mappings', () => {
    it('should return tool mapping', () => {
      const gateway = createGateway(createTestOptions());
      const mapping = gateway.getToolMapping();

      expect(mapping).toBeInstanceOf(Map);
      expect(mapping.size).toBeGreaterThan(0);
    });

    it('should return resource mapping', () => {
      const gateway = createGateway(createTestOptions());
      const mapping = gateway.getResourceMapping();

      expect(mapping).toBeInstanceOf(Map);
    });

    it('should return prompt mapping', () => {
      const gateway = createGateway(createTestOptions());
      const mapping = gateway.getPromptMapping();

      expect(mapping).toBeInstanceOf(Map);
    });
  });

  describe('upstream configuration', () => {
    it('should use custom headers', () => {
      const gateway = createGateway(
        createTestOptions({
          headers: { 'X-Gateway': 'true' },
          upstreams: [
            {
              url: 'http://server1:3000',
              headers: { 'X-Server': 'one' },
            },
          ],
        }),
      );

      const options = gateway.getOptions();
      expect(options.headers).toEqual({ 'X-Gateway': 'true' });
      expect(options.upstreams[0].headers).toEqual({ 'X-Server': 'one' });
    });

    it('should use custom timeout', () => {
      const gateway = createGateway(
        createTestOptions({
          timeout: 60000,
          upstreams: [{ url: 'http://server1:3000', timeout: 5000 }],
        }),
      );

      const options = gateway.getOptions();
      expect(options.timeout).toBe(60000);
      expect(options.upstreams[0].timeout).toBe(5000);
    });

    it('should use custom retries', () => {
      const gateway = createGateway(
        createTestOptions({
          upstreams: [{ url: 'http://server1:3000', retries: 5 }],
        }),
      );

      expect(gateway.getUpstreams()[0].retries).toBe(5);
    });
  });

  describe('health check configuration', () => {
    it('should disable health check per upstream', () => {
      const gateway = createGateway(
        createTestOptions({
          upstreams: [
            { url: 'http://server1:3000', healthCheck: false },
            { url: 'http://server2:3000', healthCheck: true },
          ],
        }),
      );

      const upstreams = gateway.getUpstreams();
      expect(upstreams[0].healthCheck).toBe(false);
      expect(upstreams[1].healthCheck).toBe(true);
    });
  });

  describe('return undefined for no healthy upstreams', () => {
    it('should return undefined when all upstreams are unhealthy', () => {
      const gateway = createGateway(createTestOptions());

      // Mark all upstreams as unhealthy
      const health = gateway.getUpstreamHealth();
      for (const h of health) {
        h.healthy = false;
      }

      const upstream = gateway.selectUpstream();
      expect(upstream).toBeUndefined();
    });
  });
});
