import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  isNamedMiddleware,
  type Middleware,
  type MiddlewareContext,
  type MiddlewareInput,
  type MiddlewareOptions,
} from './types.js';

/**
 * Internal representation of middleware with resolved options
 */
interface ResolvedMiddleware {
  name: string;
  handler: Middleware;
  options: Required<MiddlewareOptions>;
}

/**
 * Creates a MiddlewareContext from a request/response pair
 */
function createContext(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId?: string,
  body?: unknown,
): MiddlewareContext {
  const host = request.headers.host ?? 'localhost';
  const url = new URL(request.url ?? '/', `http://${host}`);
  const state = new Map<string, unknown>();

  return {
    request,
    response,
    sessionId,
    url,
    method: request.method ?? 'GET',
    path: url.pathname,
    body,
    state,
    get<T>(key: string): T | undefined {
      return state.get(key) as T | undefined;
    },
    set<T>(key: string, value: T): void {
      state.set(key, value);
    },
  };
}

/**
 * Check if a path matches a pattern
 * Supports exact matches and simple glob patterns (* for any segment, ** for any path)
 */
function matchPath(path: string, pattern: string): boolean {
  if (pattern === '*' || pattern === '**') {
    return true;
  }

  if (!pattern.includes('*')) {
    return path === pattern;
  }

  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLE_STAR}}/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Check if middleware should run for the given context
 */
function shouldRunMiddleware(
  ctx: MiddlewareContext,
  options: Required<MiddlewareOptions>,
): boolean {
  // Check excluded paths first
  if (options.excludePaths.length > 0) {
    for (const pattern of options.excludePaths) {
      if (matchPath(ctx.path, pattern)) {
        return false;
      }
    }
  }

  // Check allowed paths
  if (options.paths.length > 0) {
    let pathMatches = false;
    for (const pattern of options.paths) {
      if (matchPath(ctx.path, pattern)) {
        pathMatches = true;
        break;
      }
    }
    if (!pathMatches) {
      return false;
    }
  }

  // Check allowed methods
  if (options.methods.length > 0) {
    if (!options.methods.includes(ctx.method)) {
      return false;
    }
  }

  return true;
}

/**
 * Middleware pipeline for HTTP transports
 *
 * Manages a chain of middleware functions that execute in order.
 * Each middleware can modify the context, short-circuit the chain,
 * or pass control to the next middleware.
 *
 * @example
 * ```typescript
 * const pipeline = new MiddlewarePipeline();
 *
 * // Add logging middleware
 * pipeline.use(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.path}`);
 *   await next();
 * });
 *
 * // Add authentication middleware
 * pipeline.use({
 *   name: 'auth',
 *   handler: async (ctx, next) => {
 *     const token = ctx.request.headers['authorization'];
 *     if (!token) {
 *       ctx.response.writeHead(401);
 *       ctx.response.end('Unauthorized');
 *       return; // Short-circuit - don't call next()
 *     }
 *     await next();
 *   },
 *   options: { excludePaths: ['/health'] }
 * });
 *
 * // Execute pipeline
 * await pipeline.execute(req, res, sessionId, async () => {
 *   // Final handler
 * });
 * ```
 */
export class MiddlewarePipeline {
  private middleware: ResolvedMiddleware[] = [];
  private sorted = false;

  /**
   * Add middleware to the pipeline
   *
   * @param input - Middleware function or named middleware with options
   * @returns this for chaining
   */
  use(input: MiddlewareInput): this {
    const resolved = this.resolveMiddleware(input);
    this.middleware.push(resolved);
    this.sorted = false;
    return this;
  }

  /**
   * Add multiple middleware at once
   *
   * @param inputs - Array of middleware functions or named middleware
   * @returns this for chaining
   */
  useAll(inputs: MiddlewareInput[]): this {
    for (const input of inputs) {
      this.use(input);
    }
    return this;
  }

  /**
   * Remove middleware by name
   *
   * @param name - Name of middleware to remove
   * @returns true if middleware was removed
   */
  remove(name: string): boolean {
    const index = this.middleware.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if middleware exists by name
   */
  has(name: string): boolean {
    return this.middleware.some((m) => m.name === name);
  }

  /**
   * Get the number of middleware in the pipeline
   */
  get size(): number {
    return this.middleware.length;
  }

  /**
   * Clear all middleware from the pipeline
   */
  clear(): void {
    this.middleware = [];
    this.sorted = false;
  }

  /**
   * Execute the middleware pipeline
   *
   * @param request - HTTP request
   * @param response - HTTP response
   * @param sessionId - Optional session ID
   * @param body - Optional parsed body
   * @param finalHandler - Handler to call after all middleware
   * @returns Promise that resolves when the pipeline completes
   */
  async execute(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string | undefined,
    body: unknown,
    finalHandler: (ctx: MiddlewareContext) => Promise<void>,
  ): Promise<void> {
    // Ensure middleware is sorted by order
    if (!this.sorted) {
      this.sortMiddleware();
    }

    const ctx = createContext(request, response, sessionId, body);

    // Build the middleware chain
    const applicableMiddleware = this.middleware.filter((m) => shouldRunMiddleware(ctx, m.options));

    // Execute chain using recursion
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < applicableMiddleware.length) {
        const current = applicableMiddleware[index]!;
        index++;
        await current.handler(ctx, next);
      } else {
        // All middleware completed, call final handler
        await finalHandler(ctx);
      }
    };

    await next();
  }

  /**
   * Create a composed middleware function from the pipeline
   * Useful for embedding in other pipelines
   */
  compose(): Middleware {
    return async (ctx, next) => {
      if (!this.sorted) {
        this.sortMiddleware();
      }

      const applicableMiddleware = this.middleware.filter((m) =>
        shouldRunMiddleware(ctx, m.options),
      );

      let index = 0;

      const innerNext = async (): Promise<void> => {
        if (index < applicableMiddleware.length) {
          const current = applicableMiddleware[index]!;
          index++;
          await current.handler(ctx, innerNext);
        } else {
          await next();
        }
      };

      await innerNext();
    };
  }

  /**
   * Resolve middleware input to internal format
   */
  private resolveMiddleware(input: MiddlewareInput): ResolvedMiddleware {
    if (isNamedMiddleware(input)) {
      return {
        name: input.name,
        handler: input.handler,
        options: {
          paths: input.options?.paths ?? [],
          excludePaths: input.options?.excludePaths ?? [],
          methods: input.options?.methods ?? [],
          order: input.options?.order ?? 100,
        },
      };
    }

    // Anonymous middleware
    return {
      name: `middleware_${this.middleware.length}`,
      handler: input,
      options: {
        paths: [],
        excludePaths: [],
        methods: [],
        order: 100,
      },
    };
  }

  /**
   * Sort middleware by order priority
   */
  private sortMiddleware(): void {
    this.middleware.sort((a, b) => a.options.order - b.options.order);
    this.sorted = true;
  }
}

/**
 * Create a new middleware pipeline
 */
export function createPipeline(): MiddlewarePipeline {
  return new MiddlewarePipeline();
}

/**
 * Compose multiple middleware into a single middleware
 *
 * @param middleware - Array of middleware to compose
 * @returns Single middleware that executes all in order
 */
export function compose(...middleware: Middleware[]): Middleware {
  return async (ctx, next) => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index < middleware.length) {
        const fn = middleware[index]!;
        index++;
        await fn(ctx, dispatch);
      } else {
        await next();
      }
    };

    await dispatch();
  };
}
