/**
 * Server inspection module for runtime introspection
 *
 * Provides endpoints and utilities for inspecting server state,
 * available capabilities, and runtime statistics.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { extractServerDoc } from '../docs/extractor.js';
import type { ServerDoc } from '../docs/types.js';
import type { Constructor } from '../metadata/index.js';

/**
 * Server statistics
 */
export interface ServerStats {
  /**
   * Server start time
   */
  startTime: Date;

  /**
   * Server uptime in milliseconds
   */
  uptime: number;

  /**
   * Total requests handled
   */
  totalRequests: number;

  /**
   * Requests by type
   */
  requestsByType: {
    tools: number;
    resources: number;
    prompts: number;
  };

  /**
   * Error count
   */
  errorCount: number;

  /**
   * Average response time in milliseconds
   */
  avgResponseTime: number;

  /**
   * Active sessions (for SSE/streaming transports)
   */
  activeSessions: number;
}

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /**
   * Overall health status
   */
  status: HealthStatus;

  /**
   * Detailed checks
   */
  checks: Record<
    string,
    {
      status: HealthStatus;
      message?: string;
      responseTime?: number;
    }
  >;

  /**
   * Timestamp
   */
  timestamp: string;
}

/**
 * Inspection response
 */
export interface InspectionResult {
  /**
   * Server documentation/capabilities
   */
  server: ServerDoc;

  /**
   * Server statistics
   */
  stats: ServerStats;

  /**
   * Health check result
   */
  health: HealthCheckResult;
}

/**
 * Custom health check function
 */
export type HealthCheckFn = () => Promise<{
  status: HealthStatus;
  message?: string;
}>;

/**
 * Inspection handler options
 */
export interface InspectionOptions {
  /**
   * Enable inspection endpoint
   * @default true
   */
  enabled?: boolean;

  /**
   * Endpoint path
   * @default '/_inspect'
   */
  path?: string;

  /**
   * Include statistics
   * @default true
   */
  includeStats?: boolean;

  /**
   * Include health checks
   * @default true
   */
  includeHealth?: boolean;

  /**
   * Custom health checks
   */
  healthChecks?: Record<string, HealthCheckFn>;

  /**
   * Authentication for inspection endpoint
   */
  auth?: {
    /**
     * Bearer token required to access endpoint
     */
    token?: string;
  };
}

/**
 * Server inspector class
 *
 * Tracks server statistics and provides inspection capabilities.
 */
export class ServerInspector {
  private serverClass: Constructor;
  private startTime: Date;
  private totalRequests = 0;
  private requestsByType = { tools: 0, resources: 0, prompts: 0 };
  private errorCount = 0;
  private responseTimes: number[] = [];
  private activeSessions = 0;
  private options: InspectionOptions;
  private healthChecks: Map<string, HealthCheckFn> = new Map();

  constructor(serverClass: Constructor, options: InspectionOptions = {}) {
    this.serverClass = serverClass;
    this.startTime = new Date();
    this.options = {
      enabled: true,
      path: '/_inspect',
      includeStats: true,
      includeHealth: true,
      ...options,
    };

    // Register custom health checks
    if (options.healthChecks) {
      for (const [name, check] of Object.entries(options.healthChecks)) {
        this.healthChecks.set(name, check);
      }
    }
  }

  /**
   * Record a request
   */
  recordRequest(type: 'tool' | 'resource' | 'prompt', responseTime: number, error?: boolean): void {
    this.totalRequests++;
    this.requestsByType[`${type}s` as 'tools' | 'resources' | 'prompts']++;

    if (error) {
      this.errorCount++;
    }

    // Keep last 1000 response times for averaging
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * Update active session count
   */
  updateActiveSessions(count: number): void {
    this.activeSessions = count;
  }

  /**
   * Add a custom health check
   */
  addHealthCheck(name: string, check: HealthCheckFn): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Get current statistics
   */
  getStats(): ServerStats {
    const avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    return {
      startTime: this.startTime,
      uptime: Date.now() - this.startTime.getTime(),
      totalRequests: this.totalRequests,
      requestsByType: { ...this.requestsByType },
      errorCount: this.errorCount,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      activeSessions: this.activeSessions,
    };
  }

  /**
   * Run health checks
   */
  async runHealthChecks(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: HealthStatus = 'healthy';

    // Built-in checks
    const uptimeCheck = this.startTime
      ? {
          status: 'healthy' as HealthStatus,
          message: `Uptime: ${Math.round((Date.now() - this.startTime.getTime()) / 1000)}s`,
        }
      : { status: 'unhealthy' as HealthStatus, message: 'Server not started' };

    checks.uptime = uptimeCheck;

    // Error rate check
    const errorRate = this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;

    if (errorRate > 50) {
      checks.errorRate = { status: 'unhealthy', message: `Error rate: ${errorRate.toFixed(1)}%` };
      overallStatus = 'unhealthy';
    } else if (errorRate > 10) {
      checks.errorRate = { status: 'degraded', message: `Error rate: ${errorRate.toFixed(1)}%` };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.errorRate = { status: 'healthy', message: `Error rate: ${errorRate.toFixed(1)}%` };
    }

    // Run custom health checks
    for (const [name, checkFn] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const responseTime = Date.now() - startTime;

        checks[name] = {
          status: result.status,
          message: result.message,
          responseTime,
        };

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Check failed',
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get full inspection result
   */
  async inspect(): Promise<InspectionResult> {
    const server = extractServerDoc(this.serverClass);
    const stats = this.getStats();
    const health = await this.runHealthChecks();

    return {
      server,
      stats,
      health,
    };
  }

  /**
   * Handle HTTP inspection request
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!this.options.enabled) {
      return false;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Check if this is an inspection request
    if (!url.pathname.startsWith(this.options.path ?? '/_inspect')) {
      return false;
    }

    // Check authentication
    if (this.options.auth?.token) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (token !== this.options.auth.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }
    }

    // Handle different endpoints
    const subPath = url.pathname.slice((this.options.path ?? '/_inspect').length);

    try {
      if (subPath === '' || subPath === '/') {
        // Full inspection
        const result = await this.inspect();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } else if (subPath === '/health') {
        // Health check only
        const health = await this.runHealthChecks();
        const statusCode =
          health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (subPath === '/stats') {
        // Stats only
        const stats = this.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats, null, 2));
      } else if (subPath === '/capabilities') {
        // Server capabilities only
        const server = extractServerDoc(this.serverClass);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              name: server.name,
              version: server.version,
              description: server.description,
              tools: server.tools.map((t) => ({ name: t.name, description: t.description })),
              resources: server.resources.map((r) => ({
                name: r.name,
                uri: r.uri,
                description: r.description,
              })),
              prompts: server.prompts.map((p) => ({ name: p.name, description: p.description })),
            },
            null,
            2,
          ),
        );
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal error',
        }),
      );
    }

    return true;
  }
}

/**
 * Create a server inspector
 */
export function createInspector(
  serverClass: Constructor,
  options?: InspectionOptions,
): ServerInspector {
  return new ServerInspector(serverClass, options);
}
