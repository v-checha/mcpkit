/**
 * Prometheus-compatible metrics collector
 *
 * Provides metrics collection and exposure for MCP server monitoring.
 * Uses a simple, dependency-free implementation.
 */

import type { ServerHooks } from '../types/hooks.js';

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric labels
 */
export type MetricLabels = Record<string, string>;

/**
 * Counter metric - only goes up
 */
export interface Counter {
  type: 'counter';
  name: string;
  help: string;
  values: Map<string, number>;
  inc(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  reset(): void;
}

/**
 * Gauge metric - can go up or down
 */
export interface Gauge {
  type: 'gauge';
  name: string;
  help: string;
  values: Map<string, number>;
  set(labels: MetricLabels | undefined, value: number): void;
  inc(labels?: MetricLabels, value?: number): void;
  dec(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  reset(): void;
}

/**
 * Histogram metric - tracks distribution of values
 */
export interface Histogram {
  type: 'histogram';
  name: string;
  help: string;
  buckets: number[];
  observations: Map<string, number[]>;
  observe(labels: MetricLabels | undefined, value: number): void;
  get(labels?: MetricLabels): { buckets: Map<number, number>; sum: number; count: number };
  reset(): void;
}

/**
 * Union of all metric types
 */
export type Metric = Counter | Gauge | Histogram;

/**
 * Options for creating a histogram
 */
export interface HistogramOptions {
  name: string;
  help: string;
  buckets?: number[];
}

/**
 * Options for the metrics collector
 */
export interface MetricsCollectorOptions {
  /**
   * Prefix for all metric names (default: 'mcpkit_')
   */
  prefix?: string;

  /**
   * Default histogram buckets for latency metrics
   */
  defaultBuckets?: number[];

  /**
   * Default labels to add to all metrics
   */
  defaultLabels?: MetricLabels;
}

/**
 * Convert labels to a string key
 */
function labelsToKey(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) {
    return '';
  }
  return Object.entries(labels)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

/**
 * Create a counter metric
 */
function createCounter(name: string, help: string): Counter {
  const values = new Map<string, number>();

  return {
    type: 'counter',
    name,
    help,
    values,
    inc(labels?: MetricLabels, value = 1) {
      const key = labelsToKey(labels);
      values.set(key, (values.get(key) ?? 0) + value);
    },
    get(labels?: MetricLabels): number {
      return values.get(labelsToKey(labels)) ?? 0;
    },
    reset() {
      values.clear();
    },
  };
}

/**
 * Create a gauge metric
 */
function createGauge(name: string, help: string): Gauge {
  const values = new Map<string, number>();

  return {
    type: 'gauge',
    name,
    help,
    values,
    set(labels: MetricLabels | undefined, value: number) {
      values.set(labelsToKey(labels), value);
    },
    inc(labels?: MetricLabels, value = 1) {
      const key = labelsToKey(labels);
      values.set(key, (values.get(key) ?? 0) + value);
    },
    dec(labels?: MetricLabels, value = 1) {
      const key = labelsToKey(labels);
      values.set(key, (values.get(key) ?? 0) - value);
    },
    get(labels?: MetricLabels): number {
      return values.get(labelsToKey(labels)) ?? 0;
    },
    reset() {
      values.clear();
    },
  };
}

/**
 * Create a histogram metric
 */
function createHistogram(
  name: string,
  help: string,
  buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
): Histogram {
  const sortedBuckets = [...buckets].sort((a, b) => a - b);
  const observations = new Map<string, number[]>();

  return {
    type: 'histogram',
    name,
    help,
    buckets: sortedBuckets,
    observations,
    observe(labels: MetricLabels | undefined, value: number) {
      const key = labelsToKey(labels);
      const existing = observations.get(key) ?? [];
      existing.push(value);
      observations.set(key, existing);
    },
    get(labels?: MetricLabels): { buckets: Map<number, number>; sum: number; count: number } {
      const key = labelsToKey(labels);
      const obs = observations.get(key) ?? [];
      const bucketCounts = new Map<number, number>();

      for (const bucket of sortedBuckets) {
        bucketCounts.set(bucket, obs.filter((v) => v <= bucket).length);
      }

      return {
        buckets: bucketCounts,
        sum: obs.reduce((a, b) => a + b, 0),
        count: obs.length,
      };
    },
    reset() {
      observations.clear();
    },
  };
}

/**
 * Metrics collector for MCP servers
 *
 * @example
 * ```typescript
 * const metrics = createMetricsCollector();
 *
 * // Use as hooks in @MCPServer
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   hooks: metrics.getHooks(),
 * })
 * class MyServer { ... }
 *
 * // Get metrics endpoint handler
 * app.get('/metrics', (req, res) => {
 *   res.set('Content-Type', 'text/plain');
 *   res.send(metrics.export());
 * });
 * ```
 */
export class MetricsCollector {
  private prefix: string;
  private defaultLabels: MetricLabels;
  private metrics: Map<string, Metric> = new Map();

  // Built-in metrics
  readonly toolCallsTotal: Counter;
  readonly toolErrorsTotal: Counter;
  readonly toolDurationSeconds: Histogram;
  readonly resourceReadsTotal: Counter;
  readonly resourceErrorsTotal: Counter;
  readonly resourceDurationSeconds: Histogram;
  readonly promptGetsTotal: Counter;
  readonly promptErrorsTotal: Counter;
  readonly promptDurationSeconds: Histogram;
  readonly activeConnections: Gauge;

  constructor(options: MetricsCollectorOptions = {}) {
    this.prefix = options.prefix ?? 'mcpkit_';
    this.defaultLabels = options.defaultLabels ?? {};
    const defaultBuckets = options.defaultBuckets ?? [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ];

    // Initialize built-in metrics
    this.toolCallsTotal = this.registerCounter('tool_calls_total', 'Total number of tool calls');
    this.toolErrorsTotal = this.registerCounter('tool_errors_total', 'Total number of tool errors');
    this.toolDurationSeconds = this.registerHistogram(
      'tool_duration_seconds',
      'Tool call duration in seconds',
      defaultBuckets,
    );

    this.resourceReadsTotal = this.registerCounter(
      'resource_reads_total',
      'Total number of resource reads',
    );
    this.resourceErrorsTotal = this.registerCounter(
      'resource_errors_total',
      'Total number of resource errors',
    );
    this.resourceDurationSeconds = this.registerHistogram(
      'resource_duration_seconds',
      'Resource read duration in seconds',
      defaultBuckets,
    );

    this.promptGetsTotal = this.registerCounter('prompt_gets_total', 'Total number of prompt gets');
    this.promptErrorsTotal = this.registerCounter(
      'prompt_errors_total',
      'Total number of prompt errors',
    );
    this.promptDurationSeconds = this.registerHistogram(
      'prompt_duration_seconds',
      'Prompt get duration in seconds',
      defaultBuckets,
    );

    this.activeConnections = this.registerGauge(
      'active_connections',
      'Number of active connections',
    );
  }

  /**
   * Register a new counter metric
   */
  registerCounter(name: string, help: string): Counter {
    const fullName = `${this.prefix}${name}`;
    const counter = createCounter(fullName, help);
    this.metrics.set(fullName, counter);
    return counter;
  }

  /**
   * Register a new gauge metric
   */
  registerGauge(name: string, help: string): Gauge {
    const fullName = `${this.prefix}${name}`;
    const gauge = createGauge(fullName, help);
    this.metrics.set(fullName, gauge);
    return gauge;
  }

  /**
   * Register a new histogram metric
   */
  registerHistogram(name: string, help: string, buckets?: number[]): Histogram {
    const fullName = `${this.prefix}${name}`;
    const histogram = createHistogram(fullName, help, buckets);
    this.metrics.set(fullName, histogram);
    return histogram;
  }

  /**
   * Get a metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(`${this.prefix}${name}`);
  }

  /**
   * Export all metrics in Prometheus text format
   */
  export(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        for (const [labelKey, value] of metric.values) {
          const fullLabels = this.formatLabels(labelKey);
          lines.push(`${metric.name}${fullLabels} ${value}`);
        }
        // If no values, output 0
        if (metric.values.size === 0) {
          const fullLabels = this.formatLabels('');
          lines.push(`${metric.name}${fullLabels} 0`);
        }
      } else if (metric.type === 'histogram') {
        for (const [labelKey] of metric.observations) {
          const result = metric.get(this.parseLabels(labelKey));

          for (const [le, count] of result.buckets) {
            const bucketLabels = this.formatLabels(labelKey, { le: String(le) });
            lines.push(`${metric.name}_bucket${bucketLabels} ${count}`);
          }

          // +Inf bucket
          const infLabels = this.formatLabels(labelKey, { le: '+Inf' });
          lines.push(`${metric.name}_bucket${infLabels} ${result.count}`);

          // Sum and count
          const baseLabels = this.formatLabels(labelKey);
          lines.push(`${metric.name}_sum${baseLabels} ${result.sum}`);
          lines.push(`${metric.name}_count${baseLabels} ${result.count}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(existingKey: string, extraLabels?: Record<string, string>): string {
    const labels: Record<string, string> = { ...this.defaultLabels };

    // Parse existing key
    if (existingKey) {
      const parsed = this.parseLabels(existingKey);
      Object.assign(labels, parsed);
    }

    // Add extra labels
    if (extraLabels) {
      Object.assign(labels, extraLabels);
    }

    const entries = Object.entries(labels);
    if (entries.length === 0) {
      return '';
    }

    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  /**
   * Parse a label key back into labels
   */
  private parseLabels(key: string): Record<string, string> {
    if (!key) return {};

    const labels: Record<string, string> = {};
    const parts = key.split(',');

    for (const part of parts) {
      const match = part.match(/^([^=]+)="([^"]*)"$/);
      if (match?.[1] && match[2] !== undefined) {
        labels[match[1]] = match[2];
      }
    }

    return labels;
  }

  /**
   * Get server hooks for automatic metrics collection
   */
  getHooks(): Partial<ServerHooks> {
    return {
      onToolCall: ({ toolName }) => {
        this.toolCallsTotal.inc({ tool: toolName });
      },
      onToolSuccess: ({ toolName, duration }) => {
        const durationSeconds = (duration ?? 0) / 1000;
        this.toolDurationSeconds.observe({ tool: toolName }, durationSeconds);
      },
      onToolError: ({ toolName, duration }) => {
        this.toolErrorsTotal.inc({ tool: toolName });
        const durationSeconds = (duration ?? 0) / 1000;
        this.toolDurationSeconds.observe({ tool: toolName }, durationSeconds);
      },
      onResourceRead: ({ uri }) => {
        this.resourceReadsTotal.inc({ uri });
      },
      onResourceSuccess: ({ uri, duration }) => {
        const durationSeconds = (duration ?? 0) / 1000;
        this.resourceDurationSeconds.observe({ uri }, durationSeconds);
      },
      onResourceError: ({ uri, duration }) => {
        this.resourceErrorsTotal.inc({ uri });
        const durationSeconds = (duration ?? 0) / 1000;
        this.resourceDurationSeconds.observe({ uri }, durationSeconds);
      },
      onPromptGet: ({ promptName }) => {
        this.promptGetsTotal.inc({ prompt: promptName });
      },
      onPromptSuccess: ({ promptName, duration }) => {
        const durationSeconds = (duration ?? 0) / 1000;
        this.promptDurationSeconds.observe({ prompt: promptName }, durationSeconds);
      },
      onPromptError: ({ promptName, duration }) => {
        this.promptErrorsTotal.inc({ prompt: promptName });
        const durationSeconds = (duration ?? 0) / 1000;
        this.promptDurationSeconds.observe({ prompt: promptName }, durationSeconds);
      },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }
}

/**
 * Create a new metrics collector
 */
export function createMetricsCollector(options?: MetricsCollectorOptions): MetricsCollector {
  return new MetricsCollector(options);
}

/**
 * Create a metrics plugin
 *
 * @example
 * ```typescript
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   plugins: [metricsPlugin()],
 * })
 * ```
 */
export function metricsPlugin(options?: MetricsCollectorOptions) {
  const collector = createMetricsCollector(options);

  return {
    name: 'mcpkit-metrics',
    version: '1.0.0',
    description: 'Prometheus-compatible metrics collection',
    hooks: collector.getHooks(),
    api: {
      collector,
      export: () => collector.export(),
      reset: () => collector.reset(),
    },
  };
}
