/**
 * Middleware chain enhancements
 *
 * Advanced utilities for building sophisticated middleware pipelines.
 */

import type { Middleware, MiddlewareContext, MiddlewareInput, NamedMiddleware } from './types.js';

/**
 * Options for conditional middleware
 */
export interface ConditionalOptions {
  /**
   * Predicate function to determine if middleware should run
   */
  when: (ctx: MiddlewareContext) => boolean | Promise<boolean>;

  /**
   * Optional fallback middleware if condition is false
   */
  otherwise?: Middleware;
}

/**
 * Create middleware that only runs when a condition is met
 *
 * @example
 * ```typescript
 * const adminOnly = conditional(
 *   async (ctx, next) => {
 *     // Admin-only logic
 *     await next();
 *   },
 *   {
 *     when: (ctx) => ctx.get<AuthContext>('auth')?.role === 'admin',
 *     otherwise: async (ctx, next) => {
 *       ctx.response.writeHead(403);
 *       ctx.response.end('Forbidden');
 *     }
 *   }
 * );
 * ```
 */
export function conditional(
  middleware: Middleware,
  options: ConditionalOptions,
): Middleware {
  return async (ctx, next) => {
    const shouldRun = await options.when(ctx);

    if (shouldRun) {
      await middleware(ctx, next);
    } else if (options.otherwise) {
      await options.otherwise(ctx, next);
    } else {
      await next();
    }
  };
}

/**
 * Options for timeout middleware
 */
export interface TimeoutOptions {
  /**
   * Timeout in milliseconds
   */
  ms: number;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * HTTP status code to send on timeout (default: 408 Request Timeout)
   */
  statusCode?: number;

  /**
   * Custom handler for timeout
   */
  onTimeout?: (ctx: MiddlewareContext) => void | Promise<void>;
}

/**
 * Wrap middleware with a timeout
 *
 * @example
 * ```typescript
 * const slowOperation = withTimeout(
 *   async (ctx, next) => {
 *     await performSlowOperation();
 *     await next();
 *   },
 *   { ms: 5000, message: 'Operation timed out' }
 * );
 * ```
 */
export function withTimeout(
  middleware: Middleware,
  options: TimeoutOptions,
): Middleware {
  return async (ctx, next) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.ms);

    try {
      await Promise.race([
        middleware(ctx, next),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new TimeoutError(options.message ?? 'Request timed out'));
          });
        }),
      ]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        if (options.onTimeout) {
          await options.onTimeout(ctx);
        } else {
          const statusCode = options.statusCode ?? 408;
          if (!ctx.response.headersSent) {
            ctx.response.writeHead(statusCode, { 'Content-Type': 'application/json' });
            ctx.response.end(JSON.stringify({ error: error.message }));
          }
        }
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Custom timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Options for error handling middleware
 */
export interface ErrorHandlerOptions {
  /**
   * Whether to log errors to stderr (default: true)
   */
  log?: boolean;

  /**
   * Custom error handler
   */
  handler?: (error: Error, ctx: MiddlewareContext) => void | Promise<void>;

  /**
   * Transform error message for response (default: returns error.message)
   */
  formatError?: (error: Error) => string | object;

  /**
   * HTTP status code for errors (default: 500)
   */
  statusCode?: number;
}

/**
 * Wrap middleware with error handling
 *
 * @example
 * ```typescript
 * const safeMiddleware = withErrorHandler(
 *   async (ctx, next) => {
 *     // This might throw
 *     await riskyOperation();
 *     await next();
 *   },
 *   {
 *     log: true,
 *     formatError: (err) => ({ error: err.message, code: 'INTERNAL_ERROR' }),
 *   }
 * );
 * ```
 */
export function withErrorHandler(
  middleware: Middleware,
  options: ErrorHandlerOptions = {},
): Middleware {
  return async (ctx, next) => {
    try {
      await middleware(ctx, next);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Log error if enabled
      if (options.log !== false) {
        console.error('[Middleware Error]', err);
      }

      // Call custom handler if provided
      if (options.handler) {
        await options.handler(err, ctx);
        return;
      }

      // Default error response
      if (!ctx.response.headersSent) {
        const statusCode = options.statusCode ?? 500;
        const body = options.formatError
          ? options.formatError(err)
          : { error: err.message };

        ctx.response.writeHead(statusCode, { 'Content-Type': 'application/json' });
        ctx.response.end(JSON.stringify(body));
      }
    }
  };
}

/**
 * Options for retry middleware
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts (default: 3)
   */
  attempts?: number;

  /**
   * Delay between retries in ms (default: 1000)
   */
  delay?: number;

  /**
   * Multiplier for exponential backoff (default: 1 = no backoff)
   */
  backoff?: number;

  /**
   * Maximum delay between retries in ms (default: 30000)
   */
  maxDelay?: number;

  /**
   * Predicate to determine if error is retryable
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Called on each retry
   */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Wrap middleware with retry logic
 *
 * @example
 * ```typescript
 * const reliableMiddleware = withRetry(
 *   async (ctx, next) => {
 *     await unreliableExternalCall();
 *     await next();
 *   },
 *   {
 *     attempts: 3,
 *     delay: 1000,
 *     backoff: 2,
 *     shouldRetry: (err) => err.message.includes('ECONNRESET'),
 *   }
 * );
 * ```
 */
export function withRetry(
  middleware: Middleware,
  options: RetryOptions = {},
): Middleware {
  const {
    attempts = 3,
    delay = 1000,
    backoff = 1,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  return async (ctx, next) => {
    let lastError: Error | undefined;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await middleware(ctx, next);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt >= attempts || !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(currentDelay * backoff, maxDelay);
      }
    }

    if (lastError) {
      throw lastError;
    }
  };
}

/**
 * Options for middleware group
 */
export interface MiddlewareGroupOptions {
  /**
   * Group name
   */
  name: string;

  /**
   * Middleware in the group
   */
  middleware: MiddlewareInput[];

  /**
   * Order priority for the group (lower runs first)
   */
  order?: number;
}

/**
 * Create a named middleware group
 *
 * @example
 * ```typescript
 * const securityGroup = createMiddlewareGroup({
 *   name: 'security',
 *   middleware: [
 *     corsMiddleware(),
 *     rateLimitMiddleware(),
 *     authMiddleware(),
 *   ],
 *   order: 10,
 * });
 * ```
 */
export function createMiddlewareGroup(
  options: MiddlewareGroupOptions,
): NamedMiddleware {
  return {
    name: options.name,
    handler: composeMiddleware(options.middleware),
    options: {
      order: options.order ?? 100,
    },
  };
}

/**
 * Compose multiple middleware inputs into a single middleware
 */
function composeMiddleware(inputs: MiddlewareInput[]): Middleware {
  const handlers = inputs.map((input) => {
    if (typeof input === 'function') {
      return input;
    }
    return input.handler;
  });

  return async (ctx, next) => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index < handlers.length) {
        const fn = handlers[index]!;
        index++;
        await fn(ctx, dispatch);
      } else {
        await next();
      }
    };

    await dispatch();
  };
}

/**
 * Options for before/after hooks
 */
export interface MiddlewareHooksOptions {
  /**
   * Called before the middleware runs
   */
  before?: (ctx: MiddlewareContext) => void | Promise<void>;

  /**
   * Called after the middleware completes successfully
   */
  after?: (ctx: MiddlewareContext) => void | Promise<void>;

  /**
   * Called when the middleware throws an error
   */
  onError?: (error: Error, ctx: MiddlewareContext) => void | Promise<void>;

  /**
   * Called after middleware completes (success or error)
   */
  finally?: (ctx: MiddlewareContext) => void | Promise<void>;
}

/**
 * Add lifecycle hooks to middleware
 *
 * @example
 * ```typescript
 * const trackedMiddleware = withHooks(
 *   myMiddleware,
 *   {
 *     before: (ctx) => console.log('Starting...'),
 *     after: (ctx) => console.log('Completed'),
 *     onError: (err, ctx) => console.error('Failed:', err),
 *     finally: (ctx) => console.log('Done'),
 *   }
 * );
 * ```
 */
export function withHooks(
  middleware: Middleware,
  hooks: MiddlewareHooksOptions,
): Middleware {
  return async (ctx, next) => {
    try {
      if (hooks.before) {
        await hooks.before(ctx);
      }

      await middleware(ctx, next);

      if (hooks.after) {
        await hooks.after(ctx);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (hooks.onError) {
        await hooks.onError(err, ctx);
      }

      throw error;
    } finally {
      if (hooks.finally) {
        await hooks.finally(ctx);
      }
    }
  };
}

/**
 * Create a middleware that runs multiple middleware in parallel
 * All middleware must call next() for the chain to continue
 *
 * @example
 * ```typescript
 * const parallel = parallelMiddleware([
 *   validateHeaders,
 *   checkRateLimit,
 *   logRequest,
 * ]);
 * ```
 */
export function parallelMiddleware(middleware: Middleware[]): Middleware {
  return async (ctx, next) => {
    // Run all middleware in parallel, each with its own next
    await Promise.all(
      middleware.map((mw) => mw(ctx, async () => {})),
    );

    // All completed, continue chain
    await next();
  };
}

/**
 * Create a middleware that applies different middleware based on a selector
 *
 * @example
 * ```typescript
 * const routeMiddleware = selectMiddleware(
 *   (ctx) => ctx.path.startsWith('/api') ? 'api' : 'web',
 *   {
 *     api: apiAuthMiddleware,
 *     web: sessionMiddleware,
 *   }
 * );
 * ```
 */
export function selectMiddleware<K extends string>(
  selector: (ctx: MiddlewareContext) => K | Promise<K>,
  handlers: Record<K, Middleware>,
  fallback?: Middleware,
): Middleware {
  return async (ctx, next) => {
    const key = await selector(ctx);
    const handler = handlers[key] ?? fallback;

    if (handler) {
      await handler(ctx, next);
    } else {
      await next();
    }
  };
}

/**
 * Create middleware that caches results based on a key
 *
 * @example
 * ```typescript
 * const cachedMiddleware = withCache(
 *   expensiveMiddleware,
 *   {
 *     getKey: (ctx) => ctx.path,
 *     ttl: 60000, // 1 minute
 *   }
 * );
 * ```
 */
export interface CacheOptions {
  /**
   * Get cache key from context
   */
  getKey: (ctx: MiddlewareContext) => string;

  /**
   * Time to live in milliseconds
   */
  ttl?: number;

  /**
   * Maximum cache size
   */
  maxSize?: number;
}

/**
 * Create a cached middleware wrapper
 *
 * Note: This caches whether middleware was run successfully,
 * not the response content. Useful for expensive validation/auth checks.
 */
export function withCache(
  middleware: Middleware,
  options: CacheOptions,
): Middleware {
  const cache = new Map<string, { timestamp: number }>();
  const { ttl = 60000, maxSize = 1000 } = options;

  return async (ctx, next) => {
    const key = options.getKey(ctx);
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttl) {
      // Cache hit, skip middleware
      await next();
      return;
    }

    // Run middleware
    await middleware(ctx, next);

    // Update cache
    if (cache.size >= maxSize) {
      // Remove oldest entries
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(maxSize / 4));
      for (const [k] of toRemove) {
        cache.delete(k);
      }
    }

    cache.set(key, { timestamp: now });
  };
}
