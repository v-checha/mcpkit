import 'reflect-metadata';
import type { Span, SpanAttributes, SpanKind, Tracer } from '../observability/tracing.js';

/**
 * Metadata key for Traced options
 */
const TRACED_KEY = Symbol('mcpkit:traced');

/**
 * Options for the @Traced decorator
 */
export interface TracedOptions {
  /**
   * Custom span name. Defaults to method name.
   */
  name?: string;

  /**
   * Span kind (internal, server, client, producer, consumer)
   * @default 'internal'
   */
  kind?: SpanKind;

  /**
   * Static attributes to add to the span
   */
  attributes?: SpanAttributes;

  /**
   * Function to extract attributes from method arguments
   * @param args - The method arguments
   * @returns Attributes to add to the span
   */
  extractAttributes?: (...args: unknown[]) => SpanAttributes;

  /**
   * Whether to record the result as an attribute
   * @default false
   */
  recordResult?: boolean;

  /**
   * Maximum size of result to record (to avoid large payloads)
   * @default 1000
   */
  maxResultSize?: number;

  /**
   * Skip tracing if no tracer is configured
   * @default true
   */
  optional?: boolean;
}

/**
 * Traced method metadata
 */
interface TracedMetadata {
  propertyKey: string | symbol;
  options: TracedOptions;
}

/**
 * Global tracer instance for use by @Traced decorator
 */
let globalTracer: Tracer | undefined;

/**
 * Set the global tracer for @Traced decorator
 * @param tracer - The tracer instance
 */
export function setGlobalTracer(tracer: Tracer | undefined): void {
  globalTracer = tracer;
}

/**
 * Get the current global tracer
 */
export function getGlobalTracer(): Tracer | undefined {
  return globalTracer;
}

/**
 * Method decorator for automatic span creation
 *
 * Wraps a method with tracing, automatically creating a span that captures
 * execution time, attributes, and any errors that occur.
 *
 * @example
 * ```typescript
 * import { createTracer, consoleExporter, setGlobalTracer } from '@mcpkit-dev/core';
 *
 * // Setup tracer
 * const tracer = createTracer({
 *   serviceName: 'my-server',
 *   exporters: [consoleExporter()],
 * });
 * setGlobalTracer(tracer);
 *
 * @MCPServer({ name: 'my-server', version: '1.0.0' })
 * class MyServer {
 *   // Basic tracing
 *   @Tool({ description: 'Process data' })
 *   @Traced()
 *   async processData(@Param({ name: 'input' }) input: string) {
 *     return `Processed: ${input}`;
 *   }
 *
 *   // Custom span name and attributes
 *   @Tool({ description: 'Fetch user' })
 *   @Traced({
 *     name: 'user.fetch',
 *     kind: 'client',
 *     attributes: { 'db.system': 'postgresql' },
 *     extractAttributes: (userId) => ({ 'user.id': userId }),
 *     recordResult: true,
 *   })
 *   async getUser(@Param({ name: 'userId' }) userId: string) {
 *     return { id: userId, name: 'John' };
 *   }
 * }
 * ```
 *
 * @param options - Configuration options for tracing
 */
export function Traced(options: TracedOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Store metadata for inspection
    const key = `${TRACED_KEY.toString()}:${String(propertyKey)}`;
    Reflect.defineMetadata(key, options, target);

    // Store in class-level metadata for bootstrap access
    const existingTraced: TracedMetadata[] = Reflect.getMetadata(TRACED_KEY, target) ?? [];
    existingTraced.push({
      propertyKey,
      options,
    });
    Reflect.defineMetadata(TRACED_KEY, existingTraced, target);

    const originalMethod = descriptor.value;

    if (typeof originalMethod === 'function') {
      descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
        const tracer = globalTracer;

        // If no tracer and optional is true, just run the method
        if (!tracer) {
          if (options.optional !== false) {
            return originalMethod.apply(this, args);
          }
          throw new Error(`No tracer configured for @Traced method ${String(propertyKey)}`);
        }

        const spanName = options.name ?? String(propertyKey);
        const spanKind = options.kind ?? 'internal';

        // Build initial attributes
        const attributes: SpanAttributes = {
          'code.function': String(propertyKey),
          ...options.attributes,
        };

        // Extract dynamic attributes from arguments
        if (options.extractAttributes) {
          try {
            const extracted = options.extractAttributes(...args);
            Object.assign(attributes, extracted);
          } catch {
            // Ignore extraction errors
          }
        }

        // Use withSpan for automatic error handling and timing
        return tracer.withSpan(
          spanName,
          async (span: Span) => {
            // Set additional attributes
            span.setAttributes(attributes);

            const result = await originalMethod.apply(this, args);

            // Record result if configured
            if (options.recordResult && result !== undefined) {
              recordResultAttribute(span, result, options.maxResultSize ?? 1000);
            }

            return result;
          },
          { kind: spanKind, attributes },
        );
      };
    }
  };
}

/**
 * Record result as span attribute with size limiting
 */
function recordResultAttribute(span: Span, result: unknown, maxSize: number): void {
  try {
    let resultStr: string;
    if (typeof result === 'string') {
      resultStr = result;
    } else if (typeof result === 'number' || typeof result === 'boolean') {
      resultStr = String(result);
    } else {
      resultStr = JSON.stringify(result);
    }

    if (resultStr.length > maxSize) {
      resultStr = `${resultStr.slice(0, maxSize)}... [truncated]`;
    }

    span.setAttribute('code.result', resultStr);
  } catch {
    span.setAttribute('code.result', '[unable to serialize]');
  }
}

/**
 * Get Traced options for a method
 */
export function getTracedOptions(
  target: object,
  propertyKey: string | symbol,
): TracedOptions | undefined {
  const key = `${TRACED_KEY.toString()}:${String(propertyKey)}`;
  return Reflect.getMetadata(key, target);
}

/**
 * Get all methods with Traced decorator
 */
export function getTracedMetadata(target: object): TracedMetadata[] {
  return Reflect.getMetadata(TRACED_KEY, target) ?? [];
}

/**
 * Check if a method has tracing enabled
 */
export function isTraced(target: object, propertyKey: string | symbol): boolean {
  return getTracedOptions(target, propertyKey) !== undefined;
}

/**
 * Create a traced function wrapper
 * Useful for tracing non-method functions
 *
 * @example
 * ```typescript
 * const tracedFetch = traced('http.fetch', async (url: string) => {
 *   return fetch(url);
 * }, { kind: 'client', attributes: { 'http.method': 'GET' } });
 *
 * const response = await tracedFetch('https://api.example.com/data');
 * ```
 */
export function traced<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: Omit<TracedOptions, 'name'> = {},
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const tracer = globalTracer;

    if (!tracer) {
      if (options.optional !== false) {
        return fn(...args);
      }
      throw new Error(`No tracer configured for traced function ${name}`);
    }

    const attributes: SpanAttributes = { ...options.attributes };

    if (options.extractAttributes) {
      try {
        const extracted = options.extractAttributes(...args);
        Object.assign(attributes, extracted);
      } catch {
        // Ignore extraction errors
      }
    }

    return tracer.withSpan(
      name,
      async (span) => {
        span.setAttributes(attributes);
        const result = await fn(...args);

        if (options.recordResult && result !== undefined) {
          recordResultAttribute(span, result, options.maxResultSize ?? 1000);
        }

        return result;
      },
      { kind: options.kind ?? 'internal', attributes },
    );
  };
}

/**
 * Run a function within a trace context
 * @param name - Span name
 * @param fn - Function to execute
 * @param options - Tracing options
 */
export async function withTrace<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: TracedOptions,
): Promise<T> {
  const tracer = globalTracer;

  if (!tracer) {
    if (options?.optional !== false) {
      // Create a no-op span for compatibility
      const noopSpan: Span = {
        name,
        spanId: '',
        traceId: '',
        kind: 'internal',
        startTime: Date.now(),
        statusCode: 'unset',
        attributes: {},
        events: [],
        links: [],
        setAttribute: () => {},
        setAttributes: () => {},
        addEvent: () => {},
        setStatus: () => {},
        end: () => {},
        isEnded: () => false,
        recordException: () => {},
      };
      return fn(noopSpan);
    }
    throw new Error(`No tracer configured for withTrace ${name}`);
  }

  return tracer.withSpan(name, fn, {
    kind: options?.kind ?? 'internal',
    attributes: options?.attributes,
  });
}
