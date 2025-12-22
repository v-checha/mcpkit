import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  tracing,
  advancedTracing,
  getCorrelationId,
  getTraceContext,
  TraceContext,
  CORRELATION_ID_KEY,
  TRACE_CONTEXT_KEY,
} from './tracing.js';
import type { MiddlewareContext } from './types.js';

describe('Tracing Middleware', () => {
  // Helper to create mock context
  function createMockContext(headers: Record<string, string> = {}): MiddlewareContext {
    const state = new Map<string, unknown>();

    return {
      request: {
        headers: Object.fromEntries(
          Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
        ),
      } as unknown as IncomingMessage,
      response: {
        setHeader: vi.fn(),
      } as unknown as ServerResponse,
      sessionId: 'test-session',
      url: new URL('http://localhost:3000/test'),
      method: 'POST',
      path: '/test',
      state,
      get: <T>(key: string) => state.get(key) as T | undefined,
      set: <T>(key: string, value: T) => { state.set(key, value); },
    };
  }

  describe('tracing middleware', () => {
    it('should generate correlation ID if not present', async () => {
      const middleware = tracing();
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      const correlationId = getCorrelationId(ctx);
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
    });

    it('should use existing correlation ID from header', async () => {
      const middleware = tracing({ headerName: 'x-correlation-id' });
      const ctx = createMockContext({ 'x-correlation-id': 'existing-id-123' });

      await middleware(ctx, async () => {});

      const correlationId = getCorrelationId(ctx);
      expect(correlationId).toBe('existing-id-123');
    });

    it('should add correlation ID to response headers', async () => {
      const middleware = tracing({ includeInResponse: true });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(ctx.response.setHeader).toHaveBeenCalledWith(
        'x-correlation-id',
        expect.any(String)
      );
    });

    it('should not add to response when disabled', async () => {
      const middleware = tracing({ includeInResponse: false });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(ctx.response.setHeader).not.toHaveBeenCalled();
    });

    it('should use custom header name', async () => {
      const middleware = tracing({ headerName: 'x-request-id' });
      const ctx = createMockContext({ 'x-request-id': 'custom-123' });

      await middleware(ctx, async () => {});

      expect(getCorrelationId(ctx)).toBe('custom-123');
    });

    it('should use custom ID generator', async () => {
      const customGenerator = () => 'custom-generated-id';
      const middleware = tracing({ generator: customGenerator });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(getCorrelationId(ctx)).toBe('custom-generated-id');
    });

    it('should log when enabled', async () => {
      const logger = vi.fn();
      const middleware = tracing({ log: true, logger });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(logger).toHaveBeenCalled();
    });

    it('should not generate ID when generateIfMissing is false', async () => {
      const middleware = tracing({ generateIfMissing: false });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(getCorrelationId(ctx)).toBeUndefined();
    });
  });

  describe('TraceContext', () => {
    it('should create spans with unique IDs', () => {
      const ctx = new TraceContext('test-correlation-id');

      const span1 = ctx.startSpan('operation1');
      ctx.endSpan();

      const span2 = ctx.startSpan('operation2');
      ctx.endSpan();

      expect(span1.id).not.toBe(span2.id);
    });

    it('should track parent-child relationships', () => {
      const ctx = new TraceContext('test-correlation-id');

      const parentSpan = ctx.startSpan('parent');
      const childSpan = ctx.startSpan('child');

      expect(childSpan.parentId).toBe(parentSpan.id);

      ctx.endSpan(); // End child
      ctx.endSpan(); // End parent
    });

    it('should calculate duration', async () => {
      const ctx = new TraceContext('test-correlation-id');

      const span = ctx.startSpan('timed-operation');
      await new Promise((resolve) => setTimeout(resolve, 50));
      ctx.endSpan();

      expect(span.duration).toBeDefined();
      expect(span.duration).toBeGreaterThanOrEqual(40);
    });

    it('should mark span as error on exception', () => {
      const ctx = new TraceContext('test-correlation-id');

      ctx.startSpan('failing-operation');
      ctx.endSpan(new Error('Test error'));

      const spans = ctx.getSpans();
      expect(spans[0].status).toBe('error');
      expect(spans[0].error).toBe('Test error');
    });

    it('should trace async operations', async () => {
      const ctx = new TraceContext('test-correlation-id');

      const result = await ctx.trace('async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      expect(ctx.getSpans()).toHaveLength(1);
      expect(ctx.getSpans()[0].name).toBe('async-op');
    });

    it('should export traces', () => {
      const ctx = new TraceContext('test-correlation-id');

      ctx.startSpan('op1', { key: 'value' });
      ctx.endSpan();

      const exported = ctx.export();

      expect(exported.correlationId).toBe('test-correlation-id');
      expect(exported.spans).toHaveLength(1);
      expect(exported.spans[0].attributes.key).toBe('value');
    });

    it('should notify on span end', () => {
      const onSpanEnd = vi.fn();
      const ctx = new TraceContext('test-correlation-id', onSpanEnd);

      ctx.startSpan('operation');
      ctx.endSpan();

      expect(onSpanEnd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'operation' })
      );
    });
  });

  describe('advancedTracing middleware', () => {
    it('should create trace context', async () => {
      const middleware = advancedTracing();
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      const traceCtx = getTraceContext(ctx);
      expect(traceCtx).toBeDefined();
      expect(traceCtx).toBeInstanceOf(TraceContext);
    });

    it('should create root span for request', async () => {
      const middleware = advancedTracing();
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      const traceCtx = getTraceContext(ctx);
      const spans = traceCtx?.getSpans() ?? [];

      expect(spans).toHaveLength(1);
      expect(spans[0].name).toBe('POST /test');
    });

    it('should mark span as error on exception', async () => {
      const middleware = advancedTracing();
      const ctx = createMockContext();

      await expect(
        middleware(ctx, async () => {
          throw new Error('Request failed');
        })
      ).rejects.toThrow('Request failed');

      const traceCtx = getTraceContext(ctx);
      const spans = traceCtx?.getSpans() ?? [];

      expect(spans[0].status).toBe('error');
    });

    it('should call onSpanEnd callback', async () => {
      const onSpanEnd = vi.fn();
      const middleware = advancedTracing({ onSpanEnd });
      const ctx = createMockContext();

      await middleware(ctx, async () => {});

      expect(onSpanEnd).toHaveBeenCalled();
    });
  });
});
