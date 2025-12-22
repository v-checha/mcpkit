/**
 * OpenTelemetry-compatible tracing
 *
 * Provides distributed tracing for MCP servers.
 * Implements OpenTelemetry Trace API semantics without requiring the SDK.
 */

import type { ServerHooks } from '../types/hooks.js';

/**
 * Span kind (OpenTelemetry compatible)
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Span status code
 */
export type SpanStatusCode = 'unset' | 'ok' | 'error';

/**
 * Span attribute value types
 */
export type SpanAttributeValue = string | number | boolean | string[] | number[] | boolean[];

/**
 * Span attributes
 */
export type SpanAttributes = Record<string, SpanAttributeValue>;

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

/**
 * Span link (to other traces)
 */
export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: SpanAttributes;
}

/**
 * Trace span interface
 */
export interface Span {
  /**
   * Span name
   */
  name: string;

  /**
   * Unique span ID
   */
  spanId: string;

  /**
   * Trace ID
   */
  traceId: string;

  /**
   * Parent span ID (if any)
   */
  parentSpanId?: string;

  /**
   * Span kind
   */
  kind: SpanKind;

  /**
   * Start time in milliseconds
   */
  startTime: number;

  /**
   * End time in milliseconds
   */
  endTime?: number;

  /**
   * Duration in milliseconds
   */
  duration?: number;

  /**
   * Status code
   */
  statusCode: SpanStatusCode;

  /**
   * Status message
   */
  statusMessage?: string;

  /**
   * Span attributes
   */
  attributes: SpanAttributes;

  /**
   * Span events
   */
  events: SpanEvent[];

  /**
   * Span links
   */
  links: SpanLink[];

  /**
   * Set an attribute
   */
  setAttribute(key: string, value: SpanAttributeValue): void;

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: SpanAttributes): void;

  /**
   * Add an event
   */
  addEvent(name: string, attributes?: SpanAttributes): void;

  /**
   * Set status
   */
  setStatus(code: SpanStatusCode, message?: string): void;

  /**
   * End the span
   */
  end(): void;

  /**
   * Check if span has ended
   */
  isEnded(): boolean;

  /**
   * Record an exception
   */
  recordException(error: Error): void;
}

/**
 * Tracer interface
 */
export interface Tracer {
  /**
   * Create a new span
   */
  startSpan(name: string, options?: StartSpanOptions): Span;

  /**
   * Get current active span
   */
  getActiveSpan(): Span | undefined;

  /**
   * Run a function within a span
   */
  withSpan<T>(name: string, fn: (span: Span) => T | Promise<T>, options?: StartSpanOptions): Promise<T>;
}

/**
 * Options for starting a span
 */
export interface StartSpanOptions {
  kind?: SpanKind;
  attributes?: SpanAttributes;
  links?: SpanLink[];
  parentSpan?: Span;
}

/**
 * Span exporter interface
 */
export interface SpanExporter {
  export(spans: Span[]): void | Promise<void>;
  shutdown(): void | Promise<void>;
}

/**
 * Generate a random hex ID
 */
function generateId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a trace ID (32 hex chars)
 */
function generateTraceId(): string {
  return generateId(16);
}

/**
 * Generate a span ID (16 hex chars)
 */
function generateSpanId(): string {
  return generateId(8);
}

/**
 * Create a span implementation
 */
function createSpan(
  name: string,
  traceId: string,
  spanId: string,
  options: StartSpanOptions = {},
): Span {
  let ended = false;
  const startTime = Date.now();

  const span: Span = {
    name,
    spanId,
    traceId,
    parentSpanId: options.parentSpan?.spanId,
    kind: options.kind ?? 'internal',
    startTime,
    statusCode: 'unset',
    attributes: { ...options.attributes },
    events: [],
    links: options.links ?? [],

    setAttribute(key: string, value: SpanAttributeValue) {
      if (!ended) {
        span.attributes[key] = value;
      }
    },

    setAttributes(attributes: SpanAttributes) {
      if (!ended) {
        Object.assign(span.attributes, attributes);
      }
    },

    addEvent(eventName: string, attributes?: SpanAttributes) {
      if (!ended) {
        span.events.push({
          name: eventName,
          timestamp: Date.now(),
          attributes,
        });
      }
    },

    setStatus(code: SpanStatusCode, message?: string) {
      if (!ended) {
        span.statusCode = code;
        span.statusMessage = message;
      }
    },

    end() {
      if (!ended) {
        ended = true;
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
      }
    },

    isEnded() {
      return ended;
    },

    recordException(error: Error) {
      span.addEvent('exception', {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack ?? '',
      });
      span.setStatus('error', error.message);
    },
  };

  return span;
}

/**
 * Options for the tracer
 */
export interface TracerOptions {
  /**
   * Service name
   */
  serviceName: string;

  /**
   * Service version
   */
  serviceVersion?: string;

  /**
   * Span exporters
   */
  exporters?: SpanExporter[];

  /**
   * Maximum spans to buffer before export
   */
  maxBufferSize?: number;

  /**
   * Export interval in milliseconds
   */
  exportIntervalMs?: number;
}

/**
 * Tracer implementation
 *
 * @example
 * ```typescript
 * const tracer = createTracer({
 *   serviceName: 'my-mcp-server',
 *   exporters: [consoleExporter()],
 * });
 *
 * // Manual span creation
 * const span = tracer.startSpan('my-operation', { kind: 'server' });
 * span.setAttribute('user.id', '123');
 * try {
 *   await doSomething();
 *   span.setStatus('ok');
 * } catch (error) {
 *   span.recordException(error);
 * } finally {
 *   span.end();
 * }
 *
 * // Using withSpan helper
 * const result = await tracer.withSpan('my-operation', async (span) => {
 *   span.setAttribute('user.id', '123');
 *   return await doSomething();
 * });
 * ```
 */
export class TracerImpl implements Tracer {
  private serviceName: string;
  private serviceVersion: string;
  private exporters: SpanExporter[];
  private buffer: Span[] = [];
  private maxBufferSize: number;
  private exportInterval?: ReturnType<typeof setInterval>;
  private activeSpan?: Span;

  constructor(options: TracerOptions) {
    this.serviceName = options.serviceName;
    this.serviceVersion = options.serviceVersion ?? '1.0.0';
    this.exporters = options.exporters ?? [];
    this.maxBufferSize = options.maxBufferSize ?? 100;

    if (options.exportIntervalMs && options.exportIntervalMs > 0) {
      this.exportInterval = setInterval(() => {
        this.flush();
      }, options.exportIntervalMs);
    }
  }

  startSpan(name: string, options: StartSpanOptions = {}): Span {
    const parentSpan = options.parentSpan ?? this.activeSpan;
    const traceId = parentSpan?.traceId ?? generateTraceId();
    const spanId = generateSpanId();

    const span = createSpan(name, traceId, spanId, {
      ...options,
      parentSpan,
    });

    // Add service attributes
    span.setAttribute('service.name', this.serviceName);
    span.setAttribute('service.version', this.serviceVersion);

    this.activeSpan = span;

    return span;
  }

  getActiveSpan(): Span | undefined {
    return this.activeSpan;
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => T | Promise<T>,
    options?: StartSpanOptions,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    const previousActive = this.activeSpan;
    this.activeSpan = span;

    try {
      const result = await fn(span);
      span.setStatus('ok');
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
      this.bufferSpan(span);
      this.activeSpan = previousActive;
    }
  }

  private bufferSpan(span: Span): void {
    this.buffer.push(span);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffered spans to exporters
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const spans = [...this.buffer];
    this.buffer = [];

    for (const exporter of this.exporters) {
      try {
        await exporter.export(spans);
      } catch (error) {
        console.error('[Tracer] Export error:', error);
      }
    }
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }

    await this.flush();

    for (const exporter of this.exporters) {
      try {
        await exporter.shutdown();
      } catch (error) {
        console.error('[Tracer] Shutdown error:', error);
      }
    }
  }

  /**
   * Get server hooks for automatic tracing
   */
  getHooks(): Partial<ServerHooks> {
    const tracer = this;

    return {
      onToolCall: ({ toolName, args }) => {
        const span = tracer.startSpan(`tool:${toolName}`, { kind: 'server' });
        span.setAttribute('mcp.type', 'tool');
        span.setAttribute('mcp.tool.name', toolName);
        if (args) {
          span.setAttribute('mcp.tool.args_keys', Object.keys(args));
        }
      },
      onToolSuccess: ({ toolName, duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === `tool:${toolName}`) {
          span.setAttribute('mcp.tool.duration_ms', duration ?? 0);
          span.setStatus('ok');
          span.end();
          tracer.bufferSpan(span);
        }
      },
      onToolError: ({ toolName, error, duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === `tool:${toolName}`) {
          span.setAttribute('mcp.tool.duration_ms', duration ?? 0);
          span.recordException(error);
          span.end();
          tracer.bufferSpan(span);
        }
      },
      onResourceRead: ({ uri }) => {
        const span = tracer.startSpan(`resource:read`, { kind: 'server' });
        span.setAttribute('mcp.type', 'resource');
        span.setAttribute('mcp.resource.uri', uri);
      },
      onResourceSuccess: ({ duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === 'resource:read') {
          span.setAttribute('mcp.resource.duration_ms', duration ?? 0);
          span.setStatus('ok');
          span.end();
          tracer.bufferSpan(span);
        }
      },
      onResourceError: ({ error, duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === 'resource:read') {
          span.setAttribute('mcp.resource.duration_ms', duration ?? 0);
          span.recordException(error);
          span.end();
          tracer.bufferSpan(span);
        }
      },
      onPromptGet: ({ promptName }) => {
        const span = tracer.startSpan(`prompt:${promptName}`, { kind: 'server' });
        span.setAttribute('mcp.type', 'prompt');
        span.setAttribute('mcp.prompt.name', promptName);
      },
      onPromptSuccess: ({ promptName, duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === `prompt:${promptName}`) {
          span.setAttribute('mcp.prompt.duration_ms', duration ?? 0);
          span.setStatus('ok');
          span.end();
          tracer.bufferSpan(span);
        }
      },
      onPromptError: ({ promptName, error, duration }) => {
        const span = tracer.getActiveSpan();
        if (span && span.name === `prompt:${promptName}`) {
          span.setAttribute('mcp.prompt.duration_ms', duration ?? 0);
          span.recordException(error);
          span.end();
          tracer.bufferSpan(span);
        }
      },
    };
  }
}

/**
 * Create a tracer instance
 */
export function createTracer(options: TracerOptions): TracerImpl {
  return new TracerImpl(options);
}

/**
 * Console exporter for development
 */
export function consoleExporter(): SpanExporter {
  return {
    export(spans: Span[]) {
      for (const span of spans) {
        console.error('[Trace]', {
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          kind: span.kind,
          status: span.statusCode,
          duration: span.duration,
          attributes: span.attributes,
          events: span.events,
        });
      }
    },
    shutdown() {
      // No cleanup needed
    },
  };
}

/**
 * Memory exporter for testing
 */
export function memoryExporter(): SpanExporter & { spans: Span[]; clear: () => void } {
  const spans: Span[] = [];

  return {
    spans,
    export(newSpans: Span[]) {
      spans.push(...newSpans);
    },
    shutdown() {
      spans.length = 0;
    },
    clear() {
      spans.length = 0;
    },
  };
}

/**
 * Create a tracing plugin
 *
 * @example
 * ```typescript
 * @MCPServer({
 *   plugins: [tracingPlugin({
 *     serviceName: 'my-mcp-server',
 *     exporters: [consoleExporter()],
 *   })],
 * })
 * ```
 */
export function tracingPlugin(options: TracerOptions) {
  const tracer = createTracer(options);

  return {
    name: 'mcpkit-tracing',
    version: '1.0.0',
    description: 'OpenTelemetry-compatible distributed tracing',
    hooks: tracer.getHooks(),
    onServerStop: async () => {
      await tracer.shutdown();
    },
    api: {
      tracer,
      startSpan: (name: string, opts?: StartSpanOptions) => tracer.startSpan(name, opts),
      withSpan: <T>(name: string, fn: (span: Span) => T | Promise<T>, opts?: StartSpanOptions) =>
        tracer.withSpan(name, fn, opts),
      flush: () => tracer.flush(),
    },
  };
}
