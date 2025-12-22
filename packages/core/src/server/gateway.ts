/**
 * MCP Gateway - Proxy requests to multiple upstream MCP servers
 *
 * The gateway aggregates multiple MCP servers into a single endpoint,
 * allowing tools/resources/prompts from different servers to be exposed
 * under a unified interface with optional prefixing.
 */

import type { ServerHooks } from '../types/hooks.js';

/**
 * Upstream server configuration
 */
export interface UpstreamServer {
  /**
   * URL of the upstream MCP server
   */
  url: string;

  /**
   * Prefix to add to tool names from this server
   */
  toolPrefix?: string;

  /**
   * Prefix to add to resource URIs from this server
   */
  resourcePrefix?: string;

  /**
   * Prefix to add to prompt names from this server
   */
  promptPrefix?: string;

  /**
   * Health check enabled for this upstream
   * @default true
   */
  healthCheck?: boolean;

  /**
   * Timeout for requests to this upstream in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Number of retries for failed requests
   * @default 2
   */
  retries?: number;

  /**
   * Custom headers to send with requests
   */
  headers?: Record<string, string>;

  /**
   * Weight for load balancing (higher = more traffic)
   * @default 1
   */
  weight?: number;
}

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy = 'round-robin' | 'random' | 'least-connections' | 'weighted';

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening the circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Time in ms before attempting to close the circuit
   * @default 30000
   */
  resetTimeout?: number;

  /**
   * Time window in ms for counting failures
   * @default 60000
   */
  failureWindow?: number;
}

/**
 * Gateway configuration options
 */
export interface GatewayOptions {
  /**
   * Gateway server name
   */
  name: string;

  /**
   * Gateway server version
   */
  version: string;

  /**
   * Description of the gateway
   */
  description?: string;

  /**
   * List of upstream servers to proxy to
   */
  upstreams: UpstreamServer[];

  /**
   * Load balancing strategy for multiple upstreams
   * @default 'round-robin'
   */
  loadBalancing?: LoadBalancingStrategy;

  /**
   * Enable health checking for upstreams
   * @default true
   */
  healthCheck?: boolean;

  /**
   * Interval for health checks in milliseconds
   * @default 30000
   */
  healthCheckInterval?: number;

  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: CircuitBreakerConfig;

  /**
   * Global timeout for requests in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Default headers to send to all upstreams
   */
  headers?: Record<string, string>;

  /**
   * Server hooks
   */
  hooks?: Partial<ServerHooks>;

  /**
   * Callback when an upstream becomes unhealthy
   */
  onUpstreamUnhealthy?: (upstream: UpstreamServer, error: Error) => void;

  /**
   * Callback when an upstream recovers
   */
  onUpstreamRecovered?: (upstream: UpstreamServer) => void;
}

/**
 * Upstream health status
 */
export interface UpstreamHealth {
  /**
   * The upstream server
   */
  upstream: UpstreamServer;

  /**
   * Whether the upstream is healthy
   */
  healthy: boolean;

  /**
   * Last check timestamp
   */
  lastCheck: number;

  /**
   * Last error if unhealthy
   */
  lastError?: Error;

  /**
   * Circuit breaker state
   */
  circuitState: CircuitState;

  /**
   * Number of active connections
   */
  activeConnections: number;

  /**
   * Total number of failures
   */
  failureCount: number;
}

/**
 * Gateway class for proxying requests to upstream MCP servers
 *
 * @example
 * ```typescript
 * const gateway = createGateway({
 *   name: 'my-gateway',
 *   version: '1.0.0',
 *   upstreams: [
 *     { url: 'http://weather-server:3000', toolPrefix: 'weather_' },
 *     { url: 'http://news-server:3000', toolPrefix: 'news_' },
 *   ],
 *   loadBalancing: 'round-robin',
 *   healthCheck: true,
 * });
 *
 * await gateway.start({ transport: 'streamable-http', port: 8080 });
 * ```
 */
export class MCPGateway {
  private options: GatewayOptions;
  private upstreamHealth: Map<string, UpstreamHealth> = new Map();
  private roundRobinIndex: number = 0;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private started: boolean = false;

  constructor(options: GatewayOptions) {
    this.options = {
      ...options,
      loadBalancing: options.loadBalancing ?? 'round-robin',
      healthCheck: options.healthCheck ?? true,
      healthCheckInterval: options.healthCheckInterval ?? 30000,
      timeout: options.timeout ?? 30000,
      circuitBreaker: {
        failureThreshold: options.circuitBreaker?.failureThreshold ?? 5,
        resetTimeout: options.circuitBreaker?.resetTimeout ?? 30000,
        failureWindow: options.circuitBreaker?.failureWindow ?? 60000,
      },
    };

    // Initialize health status for each upstream
    for (const upstream of this.options.upstreams) {
      this.upstreamHealth.set(upstream.url, {
        upstream,
        healthy: true,
        lastCheck: Date.now(),
        circuitState: 'closed',
        activeConnections: 0,
        failureCount: 0,
      });
    }
  }

  /**
   * Get the gateway configuration
   */
  getOptions(): GatewayOptions {
    return { ...this.options };
  }

  /**
   * Get all upstream servers
   */
  getUpstreams(): UpstreamServer[] {
    return [...this.options.upstreams];
  }

  /**
   * Get health status of all upstreams
   */
  getUpstreamHealth(): UpstreamHealth[] {
    return Array.from(this.upstreamHealth.values());
  }

  /**
   * Get health status of a specific upstream
   */
  getUpstreamHealthByUrl(url: string): UpstreamHealth | undefined {
    return this.upstreamHealth.get(url);
  }

  /**
   * Check if the gateway is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Start the gateway
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Gateway already started');
    }

    // Initial health check
    if (this.options.healthCheck) {
      await this.performHealthChecks();

      // Start periodic health checks
      this.healthCheckTimer = setInterval(
        () => this.performHealthChecks(),
        this.options.healthCheckInterval,
      );
    }

    this.started = true;
  }

  /**
   * Stop the gateway
   */
  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    this.started = false;
  }

  /**
   * Select an upstream server based on load balancing strategy
   */
  selectUpstream(): UpstreamServer | undefined {
    const healthyUpstreams = Array.from(this.upstreamHealth.values())
      .filter((h) => h.healthy && h.circuitState !== 'open')
      .map((h) => h.upstream);

    if (healthyUpstreams.length === 0) {
      return undefined;
    }

    switch (this.options.loadBalancing) {
      case 'random':
        return healthyUpstreams[Math.floor(Math.random() * healthyUpstreams.length)];

      case 'least-connections': {
        const sorted = healthyUpstreams
          .map((upstream) => ({
            upstream,
            connections: this.upstreamHealth.get(upstream.url)?.activeConnections ?? 0,
          }))
          .sort((a, b) => a.connections - b.connections);
        return sorted[0]?.upstream;
      }

      case 'weighted': {
        const totalWeight = healthyUpstreams.reduce((sum, u) => sum + (u.weight ?? 1), 0);
        let random = Math.random() * totalWeight;
        for (const upstream of healthyUpstreams) {
          random -= upstream.weight ?? 1;
          if (random <= 0) {
            return upstream;
          }
        }
        return healthyUpstreams[0];
      }
      default: {
        const upstream = healthyUpstreams[this.roundRobinIndex % healthyUpstreams.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % healthyUpstreams.length;
        return upstream;
      }
    }
  }

  /**
   * Forward a tool call to an upstream server
   */
  async forwardToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const upstream = this.findUpstreamForTool(toolName);
    if (!upstream) {
      throw new Error(`No upstream found for tool: ${toolName}`);
    }

    const health = this.upstreamHealth.get(upstream.url);
    if (!health || !health.healthy) {
      throw new Error(`Upstream ${upstream.url} is unhealthy`);
    }

    // Remove prefix from tool name for upstream call
    const actualToolName = upstream.toolPrefix
      ? toolName.slice(upstream.toolPrefix.length)
      : toolName;

    return this.executeWithCircuitBreaker(upstream, async () => {
      // Here you would make the actual HTTP call to the upstream
      // This is a placeholder - actual implementation depends on MCP protocol
      return { toolName: actualToolName, args };
    });
  }

  /**
   * Find which upstream handles a specific tool
   */
  findUpstreamForTool(toolName: string): UpstreamServer | undefined {
    for (const upstream of this.options.upstreams) {
      if (upstream.toolPrefix && toolName.startsWith(upstream.toolPrefix)) {
        return upstream;
      }
    }
    // If no prefix matches, use load balancing
    return this.selectUpstream();
  }

  /**
   * Find which upstream handles a specific resource
   */
  findUpstreamForResource(uri: string): UpstreamServer | undefined {
    for (const upstream of this.options.upstreams) {
      if (upstream.resourcePrefix && uri.startsWith(upstream.resourcePrefix)) {
        return upstream;
      }
    }
    return this.selectUpstream();
  }

  /**
   * Find which upstream handles a specific prompt
   */
  findUpstreamForPrompt(promptName: string): UpstreamServer | undefined {
    for (const upstream of this.options.upstreams) {
      if (upstream.promptPrefix && promptName.startsWith(upstream.promptPrefix)) {
        return upstream;
      }
    }
    return this.selectUpstream();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(
    upstream: UpstreamServer,
    fn: () => Promise<T>,
  ): Promise<T> {
    const health = this.upstreamHealth.get(upstream.url);
    if (!health) {
      throw new Error(`Unknown upstream: ${upstream.url}`);
    }

    // Check circuit breaker
    if (health.circuitState === 'open') {
      const config = this.options.circuitBreaker!;
      if (Date.now() - health.lastCheck > config.resetTimeout!) {
        // Try half-open
        health.circuitState = 'half-open';
      } else {
        throw new Error(`Circuit breaker open for upstream: ${upstream.url}`);
      }
    }

    health.activeConnections++;

    try {
      const result = await fn();

      // Success - reset failure count if half-open
      if (health.circuitState === 'half-open') {
        health.circuitState = 'closed';
        health.failureCount = 0;
        this.options.onUpstreamRecovered?.(upstream);
      }

      return result;
    } catch (error) {
      health.failureCount++;
      health.lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should open the circuit
      const config = this.options.circuitBreaker!;
      if (health.failureCount >= config.failureThreshold!) {
        health.circuitState = 'open';
        health.healthy = false;
        health.lastCheck = Date.now();
        this.options.onUpstreamUnhealthy?.(upstream, health.lastError);
      }

      throw error;
    } finally {
      health.activeConnections--;
    }
  }

  /**
   * Perform health checks on all upstreams
   */
  private async performHealthChecks(): Promise<void> {
    const checks = this.options.upstreams.map(async (upstream) => {
      if (upstream.healthCheck === false) {
        return;
      }

      const health = this.upstreamHealth.get(upstream.url);
      if (!health) {
        return;
      }

      try {
        // Simple HTTP health check
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          upstream.timeout ?? this.options.timeout ?? 5000,
        );

        try {
          const response = await fetch(`${upstream.url}/health`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              ...this.options.headers,
              ...upstream.headers,
            },
          });

          clearTimeout(timeout);

          if (response.ok) {
            const wasUnhealthy = !health.healthy;
            health.healthy = true;
            health.lastCheck = Date.now();
            health.lastError = undefined;

            // Recovery from open circuit
            if (health.circuitState === 'open') {
              health.circuitState = 'half-open';
            }

            if (wasUnhealthy) {
              this.options.onUpstreamRecovered?.(upstream);
            }
          } else {
            throw new Error(`Health check failed with status ${response.status}`);
          }
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      } catch (error) {
        const wasHealthy = health.healthy;
        health.healthy = false;
        health.lastCheck = Date.now();
        health.lastError = error instanceof Error ? error : new Error(String(error));

        if (wasHealthy) {
          this.options.onUpstreamUnhealthy?.(upstream, health.lastError);
        }
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Get aggregated tools from all upstreams
   * @returns Map of tool name to upstream
   */
  getToolMapping(): Map<string, UpstreamServer> {
    const mapping = new Map<string, UpstreamServer>();

    for (const upstream of this.options.upstreams) {
      const prefix = upstream.toolPrefix ?? '';
      // In a real implementation, we would fetch tools from each upstream
      // For now, this is a placeholder
      mapping.set(`${prefix}placeholder_tool`, upstream);
    }

    return mapping;
  }

  /**
   * Get aggregated resources from all upstreams
   */
  getResourceMapping(): Map<string, UpstreamServer> {
    const mapping = new Map<string, UpstreamServer>();

    for (const upstream of this.options.upstreams) {
      const prefix = upstream.resourcePrefix ?? '';
      mapping.set(`${prefix}placeholder://resource`, upstream);
    }

    return mapping;
  }

  /**
   * Get aggregated prompts from all upstreams
   */
  getPromptMapping(): Map<string, UpstreamServer> {
    const mapping = new Map<string, UpstreamServer>();

    for (const upstream of this.options.upstreams) {
      const prefix = upstream.promptPrefix ?? '';
      mapping.set(`${prefix}placeholder_prompt`, upstream);
    }

    return mapping;
  }
}

/**
 * Create a new MCP gateway instance
 *
 * @example
 * ```typescript
 * import { createGateway } from '@mcpkit-dev/core';
 *
 * const gateway = createGateway({
 *   name: 'api-gateway',
 *   version: '1.0.0',
 *   upstreams: [
 *     {
 *       url: 'http://weather-server:3000',
 *       toolPrefix: 'weather_',
 *       healthCheck: true,
 *     },
 *     {
 *       url: 'http://news-server:3000',
 *       toolPrefix: 'news_',
 *       healthCheck: true,
 *     },
 *   ],
 *   loadBalancing: 'round-robin',
 *   circuitBreaker: {
 *     failureThreshold: 5,
 *     resetTimeout: 30000,
 *   },
 *   onUpstreamUnhealthy: (upstream, error) => {
 *     console.error(`Upstream ${upstream.url} is down:`, error.message);
 *   },
 *   onUpstreamRecovered: (upstream) => {
 *     console.log(`Upstream ${upstream.url} recovered`);
 *   },
 * });
 *
 * await gateway.start();
 * ```
 */
export function createGateway(options: GatewayOptions): MCPGateway {
  return new MCPGateway(options);
}

/**
 * Type alias for gateway instance
 */
export type Gateway = MCPGateway;
