/**
 * Observability module
 *
 * Provides metrics, health checks, and distributed tracing for MCP servers.
 *
 * @example
 * ```typescript
 * import {
 *   createMetricsCollector,
 *   createHealthChecker,
 *   createTracer,
 *   consoleExporter,
 * } from '@mcpkit-dev/core';
 *
 * // Setup metrics
 * const metrics = createMetricsCollector();
 *
 * // Setup health checks
 * const health = createHealthChecker();
 * health.addCheck({
 *   name: 'database',
 *   check: async () => {
 *     await db.ping();
 *     return { status: 'healthy' };
 *   }
 * });
 *
 * // Setup tracing
 * const tracer = createTracer({
 *   serviceName: 'my-server',
 *   exporters: [consoleExporter()],
 * });
 *
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   hooks: {
 *     ...metrics.getHooks(),
 *     ...tracer.getHooks(),
 *   },
 *   middleware: [healthMiddleware(health)],
 * })
 * class MyServer { ... }
 * ```
 *
 * @packageDocumentation
 */

// Metrics
export {
  createMetricsCollector,
  MetricsCollector,
  metricsPlugin,
} from './metrics.js';

export type {
  Counter,
  Gauge,
  Histogram,
  HistogramOptions,
  Metric,
  MetricLabels,
  MetricsCollectorOptions,
  MetricType,
} from './metrics.js';

// Health checks
export {
  createHealthChecker,
  createHealthHandler,
  HealthChecker,
  healthMiddleware,
  healthPlugin,
} from './health.js';

export type {
  HealthCheckFn,
  HealthCheckOptions,
  HealthCheckResult,
  HealthEndpointOptions,
  HealthPluginOptions,
  HealthResponse,
  HealthStatus,
} from './health.js';

// Tracing
export {
  consoleExporter,
  createTracer,
  memoryExporter,
  TracerImpl,
  tracingPlugin,
} from './tracing.js';

export type {
  Span,
  SpanAttributes,
  SpanAttributeValue,
  SpanEvent,
  SpanExporter,
  SpanKind,
  SpanLink,
  SpanStatusCode,
  StartSpanOptions,
  Tracer,
  TracerOptions,
} from './tracing.js';
