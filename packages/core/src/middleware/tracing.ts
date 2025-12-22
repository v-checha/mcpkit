/**
 * Request tracing middleware
 *
 * Adds correlation IDs to requests for distributed tracing and logging.
 */

import { randomUUID } from 'node:crypto';
import type { Middleware, MiddlewareContext, NextFunction } from './types.js';

/**
 * Tracing options
 */
export interface TracingOptions {
  /**
   * Header name to read existing correlation ID from
   * @default 'x-correlation-id'
   */
  headerName?: string;

  /**
   * Generate new ID if not present in request
   * @default true
   */
  generateIfMissing?: boolean;

  /**
   * Custom ID generator function
   */
  generator?: () => string;

  /**
   * Include correlation ID in response headers
   * @default true
   */
  includeInResponse?: boolean;

  /**
   * Log correlation IDs
   * @default false
   */
  log?: boolean;

  /**
   * Custom logger
   */
  logger?: (correlationId: string, message: string) => void;
}

/**
 * State key for correlation ID
 */
export const CORRELATION_ID_KEY = 'correlationId';

/**
 * Get correlation ID from context
 */
export function getCorrelationId(ctx: MiddlewareContext): string | undefined {
  return ctx.get<string>(CORRELATION_ID_KEY);
}

/**
 * Create request tracing middleware
 *
 * Adds correlation IDs to requests for distributed tracing.
 * IDs can be read from incoming headers or generated if missing.
 *
 * @example
 * ```typescript
 * import { tracing, getCorrelationId } from '@mcpkit-dev/core';
 *
 * const tracingMiddleware = tracing({
 *   headerName: 'x-request-id',
 *   log: true,
 * });
 *
 * // In a tool handler
 * @Tool({ description: 'My tool' })
 * async myTool(@Param({ name: 'input' }) input: string) {
 *   const correlationId = getCorrelationId(this.context);
 *   console.log(`Processing request ${correlationId}`);
 * }
 * ```
 */
export function tracing(options: TracingOptions = {}): Middleware {
  const {
    headerName = 'x-correlation-id',
    generateIfMissing = true,
    generator = randomUUID,
    includeInResponse = true,
    log = false,
    logger = (id, msg) => console.log(`[${id}] ${msg}`),
  } = options;

  return async function tracingMiddleware(
    ctx: MiddlewareContext,
    next: NextFunction,
  ): Promise<void> {
    // Try to get correlation ID from request headers
    let correlationId = ctx.request.headers[headerName.toLowerCase()] as string | undefined;

    // Generate if missing and enabled
    if (!correlationId && generateIfMissing) {
      correlationId = generator();
    }

    if (correlationId) {
      // Store in context state
      ctx.set(CORRELATION_ID_KEY, correlationId);

      // Add to response headers if enabled
      if (includeInResponse) {
        ctx.response.setHeader(headerName, correlationId);
      }

      // Log if enabled
      if (log) {
        logger(correlationId, `${ctx.method} ${ctx.path}`);
      }
    }

    await next();
  };
}

/**
 * Trace span for nested tracing
 */
export interface TraceSpan {
  /**
   * Span ID
   */
  id: string;

  /**
   * Parent span ID
   */
  parentId?: string;

  /**
   * Correlation ID
   */
  correlationId: string;

  /**
   * Span name/operation
   */
  name: string;

  /**
   * Start time
   */
  startTime: number;

  /**
   * End time (set when span ends)
   */
  endTime?: number;

  /**
   * Duration in milliseconds
   */
  duration?: number;

  /**
   * Span status
   */
  status: 'ok' | 'error';

  /**
   * Error message if status is error
   */
  error?: string;

  /**
   * Additional attributes
   */
  attributes: Record<string, unknown>;
}

/**
 * Trace context for managing spans
 */
export class TraceContext {
  private correlationId: string;
  private spans: TraceSpan[] = [];
  private currentSpan?: TraceSpan;
  private onSpanEnd?: (span: TraceSpan) => void;

  constructor(correlationId: string, onSpanEnd?: (span: TraceSpan) => void) {
    this.correlationId = correlationId;
    this.onSpanEnd = onSpanEnd;
  }

  /**
   * Get the correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Get current active span
   */
  getCurrentSpan(): TraceSpan | undefined {
    return this.currentSpan;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes: Record<string, unknown> = {}): TraceSpan {
    const span: TraceSpan = {
      id: randomUUID(),
      parentId: this.currentSpan?.id,
      correlationId: this.correlationId,
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes,
    };

    this.spans.push(span);
    this.currentSpan = span;

    return span;
  }

  /**
   * End the current span
   */
  endSpan(error?: Error): void {
    if (!this.currentSpan) return;

    this.currentSpan.endTime = Date.now();
    this.currentSpan.duration = this.currentSpan.endTime - this.currentSpan.startTime;

    if (error) {
      this.currentSpan.status = 'error';
      this.currentSpan.error = error.message;
    }

    // Notify listener
    if (this.onSpanEnd) {
      this.onSpanEnd(this.currentSpan);
    }

    // Move to parent span
    this.currentSpan = this.spans.find((s) => s.id === this.currentSpan?.parentId);
  }

  /**
   * Execute a function within a span
   */
  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    attributes: Record<string, unknown> = {},
  ): Promise<T> {
    this.startSpan(name, attributes);

    try {
      const result = await fn();
      this.endSpan();
      return result;
    } catch (error) {
      this.endSpan(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all completed spans
   */
  getSpans(): TraceSpan[] {
    return this.spans.filter((s) => s.endTime !== undefined);
  }

  /**
   * Export spans for logging/tracing systems
   */
  export(): { correlationId: string; spans: TraceSpan[] } {
    return {
      correlationId: this.correlationId,
      spans: this.getSpans(),
    };
  }
}

/**
 * State key for trace context
 */
export const TRACE_CONTEXT_KEY = 'traceContext';

/**
 * Get trace context from middleware context
 */
export function getTraceContext(ctx: MiddlewareContext): TraceContext | undefined {
  return ctx.get<TraceContext>(TRACE_CONTEXT_KEY);
}

/**
 * Create advanced tracing middleware with span support
 *
 * @example
 * ```typescript
 * const tracingMiddleware = advancedTracing({
 *   onSpanEnd: (span) => {
 *     // Send to tracing backend
 *     sendToJaeger(span);
 *   },
 * });
 * ```
 */
export function advancedTracing(options: TracingOptions & {
  onSpanEnd?: (span: TraceSpan) => void;
} = {}): Middleware {
  const baseMiddleware = tracing(options);

  return async function advancedTracingMiddleware(
    ctx: MiddlewareContext,
    next: NextFunction,
  ): Promise<void> {
    // Run base tracing first
    await baseMiddleware(ctx, async () => {
      const correlationId = getCorrelationId(ctx) ?? randomUUID();

      // Create trace context
      const traceCtx = new TraceContext(correlationId, options.onSpanEnd);
      ctx.set(TRACE_CONTEXT_KEY, traceCtx);

      // Start root span
      traceCtx.startSpan(`${ctx.method} ${ctx.path}`, {
        method: ctx.method,
        path: ctx.path,
        sessionId: ctx.sessionId,
      });

      try {
        await next();
        traceCtx.endSpan();
      } catch (error) {
        traceCtx.endSpan(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  };
}
