/**
 * Tests for @Traced decorator
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTracer, memoryExporter, type Tracer } from '../observability/tracing.js';
import {
  getGlobalTracer,
  getTracedMetadata,
  getTracedOptions,
  isTraced,
  setGlobalTracer,
  Traced,
  traced,
  withTrace,
} from './traced.js';

describe('Traced', () => {
  let tracer: Tracer & { exporter: ReturnType<typeof memoryExporter> };
  let exporter: ReturnType<typeof memoryExporter>;

  beforeEach(() => {
    exporter = memoryExporter();
    tracer = createTracer({
      serviceName: 'test-service',
      exporters: [exporter],
      maxBufferSize: 1, // Flush after each span
    }) as typeof tracer;
    (tracer as unknown as { exporter: typeof exporter }).exporter = exporter;
    setGlobalTracer(tracer);
  });

  afterEach(() => {
    setGlobalTracer(undefined);
    exporter.clear();
  });

  describe('decorator behavior', () => {
    it('should create a span for decorated method', async () => {
      class TestClass {
        @Traced()
        async tracedMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      const result = await instance.tracedMethod();

      expect(result).toBe('result');
      expect(exporter.spans.length).toBeGreaterThanOrEqual(1);
      expect(exporter.spans[0].name).toBe('tracedMethod');
    });

    it('should use custom span name', async () => {
      class TestClass {
        @Traced({ name: 'custom.operation' })
        async customNameMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      await instance.customNameMethod();

      expect(exporter.spans[0].name).toBe('custom.operation');
    });

    it('should set static attributes', async () => {
      class TestClass {
        @Traced({
          attributes: {
            'db.system': 'postgresql',
            'db.name': 'mydb',
          },
        })
        async dbMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      await instance.dbMethod();

      const span = exporter.spans[0];
      expect(span.attributes['db.system']).toBe('postgresql');
      expect(span.attributes['db.name']).toBe('mydb');
    });

    it('should extract dynamic attributes', async () => {
      class TestClass {
        @Traced({
          extractAttributes: (userId: string, action: string) => ({
            'user.id': userId,
            'user.action': action,
          }),
        })
        async userAction(userId: string, action: string) {
          return `${userId}:${action}`;
        }
      }

      const instance = new TestClass();
      await instance.userAction('user123', 'login');

      const span = exporter.spans[0];
      expect(span.attributes['user.id']).toBe('user123');
      expect(span.attributes['user.action']).toBe('login');
    });

    it('should record result when configured', async () => {
      class TestClass {
        @Traced({ recordResult: true })
        async methodWithResult() {
          return { success: true, data: 'test' };
        }
      }

      const instance = new TestClass();
      await instance.methodWithResult();

      const span = exporter.spans[0];
      expect(span.attributes['code.result']).toContain('success');
    });

    it('should truncate large results', async () => {
      class TestClass {
        @Traced({ recordResult: true, maxResultSize: 10 })
        async largeResultMethod() {
          return 'This is a very long result that should be truncated';
        }
      }

      const instance = new TestClass();
      await instance.largeResultMethod();

      const span = exporter.spans[0];
      expect((span.attributes['code.result'] as string).length).toBeLessThan(30);
      expect(span.attributes['code.result']).toContain('truncated');
    });

    it('should record exception on error', async () => {
      class TestClass {
        @Traced()
        async failingMethod() {
          throw new Error('Test error');
        }
      }

      const instance = new TestClass();
      await expect(instance.failingMethod()).rejects.toThrow('Test error');

      const span = exporter.spans[0];
      expect(span.statusCode).toBe('error');
      expect(span.events.some((e) => e.name === 'exception')).toBe(true);
    });

    it('should set span kind', async () => {
      class TestClass {
        @Traced({ kind: 'client' })
        async clientMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      await instance.clientMethod();

      const span = exporter.spans[0];
      expect(span.kind).toBe('client');
    });

    it('should work without tracer when optional is true', async () => {
      setGlobalTracer(undefined);

      class TestClass {
        @Traced({ optional: true })
        async optionalMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      const result = await instance.optionalMethod();
      expect(result).toBe('result');
    });

    it('should throw without tracer when optional is false', async () => {
      setGlobalTracer(undefined);

      class TestClass {
        @Traced({ optional: false })
        async requiredMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      await expect(instance.requiredMethod()).rejects.toThrow('No tracer configured');
    });
  });

  describe('traced function wrapper', () => {
    it('should wrap a function with tracing', async () => {
      const fn = async (x: number, y: number) => x + y;
      const tracedFn = traced('math.add', fn);

      const result = await tracedFn(5, 3);

      expect(result).toBe(8);
      expect(exporter.spans.some((s) => s.name === 'math.add')).toBe(true);
    });

    it('should extract attributes from wrapper', async () => {
      const fn = async (url: string) => ({ status: 200 });
      const tracedFn = traced('http.fetch', fn, {
        extractAttributes: (url) => ({ 'http.url': url }),
      });

      await tracedFn('https://example.com');

      const span = exporter.spans.find((s) => s.name === 'http.fetch');
      expect(span?.attributes['http.url']).toBe('https://example.com');
    });

    it('should record errors in wrapper', async () => {
      const fn = async () => {
        throw new Error('Fetch failed');
      };
      const tracedFn = traced('failing.fetch', fn);

      await expect(tracedFn()).rejects.toThrow('Fetch failed');

      const span = exporter.spans.find((s) => s.name === 'failing.fetch');
      expect(span?.statusCode).toBe('error');
    });
  });

  describe('withTrace helper', () => {
    it('should execute function within a span', async () => {
      const result = await withTrace('test.operation', async (span) => {
        span.setAttribute('custom.attr', 'value');
        return 42;
      });

      expect(result).toBe(42);
      const span = exporter.spans.find((s) => s.name === 'test.operation');
      expect(span?.attributes['custom.attr']).toBe('value');
    });

    it('should work without tracer when optional', async () => {
      setGlobalTracer(undefined);

      const result = await withTrace(
        'optional.operation',
        async (span) => {
          // Span should be a no-op
          span.setAttribute('key', 'value');
          return 'success';
        },
        { optional: true },
      );

      expect(result).toBe('success');
    });
  });

  describe('metadata utilities', () => {
    it('should get traced options', () => {
      class TestClass {
        @Traced({ name: 'custom', kind: 'client' })
        tracedMethod() {}
      }

      const options = getTracedOptions(TestClass.prototype, 'tracedMethod');
      expect(options).toBeDefined();
      expect(options?.name).toBe('custom');
      expect(options?.kind).toBe('client');
    });

    it('should get all traced metadata', () => {
      class TestClass {
        @Traced({ name: 'op1' })
        method1() {}

        @Traced({ name: 'op2' })
        method2() {}

        untracedMethod() {}
      }

      const metadata = getTracedMetadata(TestClass.prototype);
      expect(metadata).toHaveLength(2);
    });

    it('should check if method is traced', () => {
      class TestClass {
        @Traced()
        tracedMethod() {}

        untracedMethod() {}
      }

      expect(isTraced(TestClass.prototype, 'tracedMethod')).toBe(true);
      expect(isTraced(TestClass.prototype, 'untracedMethod')).toBe(false);
    });
  });

  describe('global tracer', () => {
    it('should set and get global tracer', () => {
      const newTracer = createTracer({ serviceName: 'another' });
      setGlobalTracer(newTracer);
      expect(getGlobalTracer()).toBe(newTracer);

      setGlobalTracer(undefined);
      expect(getGlobalTracer()).toBeUndefined();
    });
  });

  describe('span attributes', () => {
    it('should always include code.function attribute', async () => {
      class TestClass {
        @Traced()
        async mySpecificMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      await instance.mySpecificMethod();

      const span = exporter.spans[0];
      expect(span.attributes['code.function']).toBe('mySpecificMethod');
    });

    it('should handle extraction errors gracefully', async () => {
      class TestClass {
        @Traced({
          extractAttributes: () => {
            throw new Error('Extraction failed');
          },
        })
        async methodWithBadExtractor() {
          return 'result';
        }
      }

      const instance = new TestClass();
      // Should not throw, just skip the extraction
      const result = await instance.methodWithBadExtractor();
      expect(result).toBe('result');
    });
  });

  describe('result serialization', () => {
    it('should serialize objects', async () => {
      class TestClass {
        @Traced({ recordResult: true })
        async objectResult() {
          return { key: 'value', nested: { a: 1 } };
        }
      }

      const instance = new TestClass();
      await instance.objectResult();

      const span = exporter.spans[0];
      expect(span.attributes['code.result']).toContain('key');
      expect(span.attributes['code.result']).toContain('value');
    });

    it('should serialize primitives', async () => {
      class TestClass {
        @Traced({ recordResult: true })
        async numberResult() {
          return 42;
        }

        @Traced({ recordResult: true })
        async boolResult() {
          return true;
        }
      }

      const instance = new TestClass();

      await instance.numberResult();
      expect(exporter.spans[0].attributes['code.result']).toBe('42');

      await instance.boolResult();
      expect(exporter.spans[1].attributes['code.result']).toBe('true');
    });

    it('should handle unserializable results', async () => {
      class TestClass {
        @Traced({ recordResult: true })
        async circularResult() {
          const obj: Record<string, unknown> = {};
          obj.self = obj;
          return obj;
        }
      }

      const instance = new TestClass();
      await instance.circularResult();

      const span = exporter.spans[0];
      expect(span.attributes['code.result']).toContain('unable to serialize');
    });
  });
});
