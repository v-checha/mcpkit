/**
 * Health check system
 *
 * Provides comprehensive health check endpoints for MCP servers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware } from '../middleware/types.js';

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /**
   * Name of the check
   */
  name: string;

  /**
   * Status of the check
   */
  status: HealthStatus;

  /**
   * Optional message
   */
  message?: string;

  /**
   * Duration of the check in ms
   */
  duration?: number;

  /**
   * Additional data
   */
  data?: Record<string, unknown>;

  /**
   * Timestamp of the check
   */
  timestamp: number;
}

/**
 * Health check function
 */
export type HealthCheckFn = () => Promise<HealthCheckResult> | HealthCheckResult;

/**
 * Options for health check
 */
export interface HealthCheckOptions {
  /**
   * Name of the health check
   */
  name: string;

  /**
   * Health check function
   */
  check: () =>
    | Promise<Omit<HealthCheckResult, 'name' | 'timestamp' | 'duration'>>
    | Omit<HealthCheckResult, 'name' | 'timestamp' | 'duration'>;

  /**
   * Timeout in milliseconds (default: 5000)
   */
  timeout?: number;

  /**
   * Whether this check is critical (affects overall health)
   */
  critical?: boolean;
}

/**
 * Overall health response
 */
export interface HealthResponse {
  /**
   * Overall status
   */
  status: HealthStatus;

  /**
   * Server uptime in seconds
   */
  uptime: number;

  /**
   * Individual check results
   */
  checks: HealthCheckResult[];

  /**
   * Timestamp
   */
  timestamp: number;
}

/**
 * Options for health endpoint middleware
 */
export interface HealthEndpointOptions {
  /**
   * Path for the health endpoint (default: '/health')
   */
  path?: string;

  /**
   * Path for the liveness probe (default: '/health/live')
   */
  livePath?: string;

  /**
   * Path for the readiness probe (default: '/health/ready')
   */
  readyPath?: string;

  /**
   * Whether to include detailed check results in response
   */
  detailed?: boolean;

  /**
   * Custom response headers
   */
  headers?: Record<string, string>;
}

/**
 * Health check manager
 *
 * @example
 * ```typescript
 * const health = new HealthChecker();
 *
 * // Add a database check
 * health.addCheck({
 *   name: 'database',
 *   critical: true,
 *   check: async () => {
 *     await db.ping();
 *     return { status: 'healthy' };
 *   },
 * });
 *
 * // Add a cache check
 * health.addCheck({
 *   name: 'cache',
 *   critical: false,
 *   check: async () => {
 *     const connected = await cache.ping();
 *     return {
 *       status: connected ? 'healthy' : 'degraded',
 *       message: connected ? undefined : 'Cache unavailable',
 *     };
 *   },
 * });
 *
 * // Get overall health
 * const health = await health.check();
 * ```
 */
export class HealthChecker {
  private checks: HealthCheckOptions[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Add a health check
   */
  addCheck(options: HealthCheckOptions): this {
    this.checks.push(options);
    return this;
  }

  /**
   * Remove a health check by name
   */
  removeCheck(name: string): boolean {
    const index = this.checks.findIndex((c) => c.name === name);
    if (index >= 0) {
      this.checks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if a health check exists
   */
  hasCheck(name: string): boolean {
    return this.checks.some((c) => c.name === name);
  }

  /**
   * Run all health checks
   */
  async check(): Promise<HealthResponse> {
    const results = await Promise.all(this.checks.map((check) => this.runCheck(check)));

    const criticalChecks = this.checks.filter((c) => c.critical !== false).map((c) => c.name);

    let overallStatus: HealthStatus = 'healthy';

    for (const result of results) {
      if (result.status === 'unhealthy' && criticalChecks.includes(result.name)) {
        overallStatus = 'unhealthy';
        break;
      }
      if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: results,
      timestamp: Date.now(),
    };
  }

  /**
   * Run a single health check
   */
  private async runCheck(options: HealthCheckOptions): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? 5000;

    try {
      const result = await Promise.race([
        Promise.resolve(options.check()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), timeout),
        ),
      ]);

      return {
        name: options.name,
        status: result.status,
        message: result.message,
        data: result.data,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: options.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check liveness (is the server running?)
   */
  isLive(): boolean {
    return true; // If this code is running, the server is live
  }

  /**
   * Check readiness (is the server ready to handle requests?)
   */
  async isReady(): Promise<boolean> {
    const response = await this.check();
    return response.status !== 'unhealthy';
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

/**
 * Create a health check middleware
 *
 * @example
 * ```typescript
 * const health = new HealthChecker();
 * health.addCheck({ name: 'db', check: async () => ({ status: 'healthy' }) });
 *
 * @MCPServer({
 *   middleware: [healthMiddleware(health)],
 * })
 * ```
 */
export function healthMiddleware(
  checker: HealthChecker,
  options: HealthEndpointOptions = {},
): Middleware {
  const {
    path = '/health',
    livePath = '/health/live',
    readyPath = '/health/ready',
    detailed = true,
    headers = {},
  } = options;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...headers,
  };

  return async (ctx, next) => {
    // Handle health endpoint
    if (ctx.path === path && ctx.method === 'GET') {
      const health = await checker.check();
      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      const body = detailed ? health : { status: health.status, uptime: health.uptime };

      ctx.response.writeHead(statusCode, defaultHeaders);
      ctx.response.end(JSON.stringify(body));
      return;
    }

    // Handle liveness probe
    if (ctx.path === livePath && ctx.method === 'GET') {
      const isLive = checker.isLive();
      ctx.response.writeHead(isLive ? 200 : 503, defaultHeaders);
      ctx.response.end(JSON.stringify({ status: isLive ? 'live' : 'dead' }));
      return;
    }

    // Handle readiness probe
    if (ctx.path === readyPath && ctx.method === 'GET') {
      const isReady = await checker.isReady();
      ctx.response.writeHead(isReady ? 200 : 503, defaultHeaders);
      ctx.response.end(JSON.stringify({ status: isReady ? 'ready' : 'not_ready' }));
      return;
    }

    await next();
  };
}

/**
 * Create a standalone health check request handler
 * Useful for HTTP servers outside of the middleware pipeline
 */
export function createHealthHandler(
  checker: HealthChecker,
  options: Omit<HealthEndpointOptions, 'path'> = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { detailed = true, headers = {} } = options;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...headers,
  };

  return async (_req: IncomingMessage, res: ServerResponse) => {
    const health = await checker.check();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    const body = detailed ? health : { status: health.status, uptime: health.uptime };

    res.writeHead(statusCode, defaultHeaders);
    res.end(JSON.stringify(body));
  };
}

/**
 * Create a health checker instance
 */
export function createHealthChecker(): HealthChecker {
  return new HealthChecker();
}

/**
 * Create a health check plugin
 *
 * @example
 * ```typescript
 * @MCPServer({
 *   plugins: [healthPlugin({
 *     checks: [
 *       { name: 'db', check: async () => ({ status: 'healthy' }) }
 *     ]
 *   })],
 * })
 * ```
 */
export interface HealthPluginOptions extends HealthEndpointOptions {
  /**
   * Initial health checks to add
   */
  checks?: HealthCheckOptions[];
}

export function healthPlugin(options: HealthPluginOptions = {}) {
  const checker = createHealthChecker();

  // Add initial checks
  if (options.checks) {
    for (const check of options.checks) {
      checker.addCheck(check);
    }
  }

  return {
    name: 'mcpkit-health',
    version: '1.0.0',
    description: 'Health check endpoints',
    middleware: [healthMiddleware(checker, options)],
    api: {
      checker,
      check: () => checker.check(),
      isLive: () => checker.isLive(),
      isReady: () => checker.isReady(),
      addCheck: (opts: HealthCheckOptions) => checker.addCheck(opts),
      removeCheck: (name: string) => checker.removeCheck(name),
    },
  };
}
