/**
 * Observability tests - metrics, health, and tracing
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createHealthChecker,
  createMetricsCollector,
  createTracer,
  memoryExporter,
} from './index.js';

describe('Observability', () => {
  describe('MetricsCollector', () => {
    it('should create metrics collector with default options', () => {
      const metrics = createMetricsCollector();
      expect(metrics).toBeDefined();
    });

    it('should create metrics with custom prefix', () => {
      const metrics = createMetricsCollector({ prefix: 'myapp_' });
      const exported = metrics.export();
      expect(exported).toContain('myapp_tool_calls_total');
    });

    it('should track tool calls', () => {
      const metrics = createMetricsCollector();
      metrics.toolCallsTotal.inc({ tool: 'test-tool' });
      metrics.toolCallsTotal.inc({ tool: 'test-tool' });

      expect(metrics.toolCallsTotal.get({ tool: 'test-tool' })).toBe(2);
    });

    it('should track tool errors', () => {
      const metrics = createMetricsCollector();
      metrics.toolErrorsTotal.inc({ tool: 'test-tool' });

      expect(metrics.toolErrorsTotal.get({ tool: 'test-tool' })).toBe(1);
    });

    it('should track histogram observations', () => {
      const metrics = createMetricsCollector();
      metrics.toolDurationSeconds.observe({ tool: 'test' }, 0.1);
      metrics.toolDurationSeconds.observe({ tool: 'test' }, 0.2);

      const result = metrics.toolDurationSeconds.get({ tool: 'test' });
      expect(result.count).toBe(2);
      expect(result.sum).toBeCloseTo(0.3);
    });

    it('should export metrics in Prometheus format', () => {
      const metrics = createMetricsCollector();
      metrics.toolCallsTotal.inc({ tool: 'hello' });

      const exported = metrics.export();

      expect(exported).toContain('# HELP mcpkit_tool_calls_total');
      expect(exported).toContain('# TYPE mcpkit_tool_calls_total counter');
      expect(exported).toContain('mcpkit_tool_calls_total{tool="hello"} 1');
    });

    it('should provide hooks for automatic tracking', () => {
      const metrics = createMetricsCollector();
      const hooks = metrics.getHooks();

      expect(hooks.onToolCall).toBeDefined();
      expect(hooks.onToolSuccess).toBeDefined();
      expect(hooks.onToolError).toBeDefined();
    });

    it('should track via hooks', () => {
      const metrics = createMetricsCollector();
      const hooks = metrics.getHooks();

      hooks.onToolCall?.({ toolName: 'test', args: {}, timestamp: Date.now() });
      expect(metrics.toolCallsTotal.get({ tool: 'test' })).toBe(1);
    });

    it('should reset all metrics', () => {
      const metrics = createMetricsCollector();
      metrics.toolCallsTotal.inc({ tool: 'test' });
      metrics.reset();

      expect(metrics.toolCallsTotal.get({ tool: 'test' })).toBe(0);
    });

    it('should register custom counter', () => {
      const metrics = createMetricsCollector();
      const counter = metrics.registerCounter('custom_counter', 'A custom counter');

      counter.inc();
      expect(counter.get()).toBe(1);
    });

    it('should register custom gauge', () => {
      const metrics = createMetricsCollector();
      const gauge = metrics.registerGauge('custom_gauge', 'A custom gauge');

      gauge.set(undefined, 42);
      expect(gauge.get()).toBe(42);

      gauge.inc();
      expect(gauge.get()).toBe(43);

      gauge.dec();
      expect(gauge.get()).toBe(42);
    });
  });

  describe('HealthChecker', () => {
    it('should create health checker', () => {
      const health = createHealthChecker();
      expect(health).toBeDefined();
    });

    it('should add health check', () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'test',
        check: () => ({ status: 'healthy' }),
      });

      expect(health.hasCheck('test')).toBe(true);
    });

    it('should remove health check', () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'test',
        check: () => ({ status: 'healthy' }),
      });

      expect(health.removeCheck('test')).toBe(true);
      expect(health.hasCheck('test')).toBe(false);
    });

    it('should return healthy when all checks pass', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'db',
        check: () => ({ status: 'healthy' }),
      });
      health.addCheck({
        name: 'cache',
        check: () => ({ status: 'healthy' }),
      });

      const result = await health.check();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(2);
    });

    it('should return degraded when non-critical check fails', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'db',
        check: () => ({ status: 'healthy' }),
        critical: true,
      });
      health.addCheck({
        name: 'cache',
        check: () => ({ status: 'degraded', message: 'Slow' }),
        critical: false,
      });

      const result = await health.check();

      expect(result.status).toBe('degraded');
    });

    it('should return unhealthy when critical check fails', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'db',
        check: () => ({ status: 'unhealthy', message: 'Connection failed' }),
        critical: true,
      });

      const result = await health.check();

      expect(result.status).toBe('unhealthy');
    });

    it('should handle check timeout', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'slow',
        check: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { status: 'healthy' };
        },
        timeout: 50,
      });

      const result = await health.check();

      expect(result.checks[0].status).toBe('unhealthy');
      expect(result.checks[0].message).toContain('timeout');
    });

    it('should handle check exceptions', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'failing',
        check: () => {
          throw new Error('Check failed');
        },
      });

      const result = await health.check();

      expect(result.checks[0].status).toBe('unhealthy');
      expect(result.checks[0].message).toBe('Check failed');
    });

    it('should always be live', () => {
      const health = createHealthChecker();
      expect(health.isLive()).toBe(true);
    });

    it('should be ready when healthy', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'db',
        check: () => ({ status: 'healthy' }),
      });

      expect(await health.isReady()).toBe(true);
    });

    it('should not be ready when unhealthy', async () => {
      const health = createHealthChecker();
      health.addCheck({
        name: 'db',
        check: () => ({ status: 'unhealthy' }),
        critical: true,
      });

      expect(await health.isReady()).toBe(false);
    });

    it('should track uptime', async () => {
      const health = createHealthChecker();
      await new Promise((r) => setTimeout(r, 100));

      expect(health.getUptime()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tracer', () => {
    it('should create tracer with service name', () => {
      const tracer = createTracer({
        serviceName: 'test-service',
      });

      expect(tracer).toBeDefined();
    });

    it('should start a span', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      expect(span.name).toBe('test-span');
      expect(span.traceId).toHaveLength(32);
      expect(span.spanId).toHaveLength(16);
    });

    it('should set span attributes', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      span.setAttribute('key', 'value');
      span.setAttributes({ foo: 'bar', num: 42 });

      expect(span.attributes.key).toBe('value');
      expect(span.attributes.foo).toBe('bar');
      expect(span.attributes.num).toBe(42);
    });

    it('should add span events', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      span.addEvent('event1');
      span.addEvent('event2', { detail: 'info' });

      expect(span.events).toHaveLength(2);
      expect(span.events[0].name).toBe('event1');
      expect(span.events[1].attributes?.detail).toBe('info');
    });

    it('should set span status', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      span.setStatus('ok');
      expect(span.statusCode).toBe('ok');

      span.setStatus('error', 'Something went wrong');
      expect(span.statusCode).toBe('error');
      expect(span.statusMessage).toBe('Something went wrong');
    });

    it('should record exception', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      span.recordException(new Error('Test error'));

      expect(span.statusCode).toBe('error');
      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe('exception');
    });

    it('should end span', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      expect(span.isEnded()).toBe(false);
      span.end();
      expect(span.isEnded()).toBe(true);
      expect(span.endTime).toBeDefined();
      expect(span.duration).toBeGreaterThanOrEqual(0);
    });

    it('should not modify ended span', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const span = tracer.startSpan('test-span');

      span.end();
      span.setAttribute('key', 'value');

      expect(span.attributes.key).toBeUndefined();
    });

    it('should use withSpan helper', async () => {
      const tracer = createTracer({ serviceName: 'test' });
      let capturedSpan: typeof span | undefined;

      const result = await tracer.withSpan('test-op', async (span) => {
        capturedSpan = span;
        span.setAttribute('custom', 'value');
        return 42;
      });

      expect(result).toBe(42);
      expect(capturedSpan?.isEnded()).toBe(true);
      expect(capturedSpan?.statusCode).toBe('ok');
    });

    it('should handle errors in withSpan', async () => {
      const tracer = createTracer({ serviceName: 'test' });

      await expect(
        tracer.withSpan('failing-op', async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');
    });

    it('should export spans via exporter', async () => {
      const exporter = memoryExporter();
      const tracer = createTracer({
        serviceName: 'test',
        exporters: [exporter],
        maxBufferSize: 1,
      });

      await tracer.withSpan('test-span', async () => {
        // Do nothing
      });

      // Span should be exported
      expect(exporter.spans.length).toBeGreaterThanOrEqual(1);
    });

    it('should provide hooks for automatic tracing', () => {
      const tracer = createTracer({ serviceName: 'test' });
      const hooks = tracer.getHooks();

      expect(hooks.onToolCall).toBeDefined();
      expect(hooks.onToolSuccess).toBeDefined();
      expect(hooks.onToolError).toBeDefined();
    });

    it('should link parent and child spans', () => {
      const tracer = createTracer({ serviceName: 'test' });

      const parent = tracer.startSpan('parent');
      const child = tracer.startSpan('child', { parentSpan: parent });

      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.traceId).toBe(parent.traceId);
    });
  });
});
