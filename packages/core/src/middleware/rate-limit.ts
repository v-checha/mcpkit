import type { Middleware, MiddlewareContext } from './types.js';
import { STATE_KEYS } from './types.js';

/**
 * Rate limit store interface
 * Implement this to use Redis, database, or other external stores
 */
export interface RateLimitStore {
  /**
   * Increment the counter for a key and return current state
   *
   * @param key - Unique identifier for the rate limit bucket
   * @param windowMs - Window size in milliseconds
   * @returns Current count and reset time
   */
  increment(
    key: string,
    windowMs: number,
  ): Promise<{
    count: number;
    resetTime: number;
  }>;

  /**
   * Reset the counter for a key (optional)
   */
  reset?(key: string): Promise<void>;
}

/**
 * In-memory rate limit store using sliding window algorithm
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private windows: Map<
    string,
    {
      count: number;
      resetTime: number;
    }
  > = new Map();

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    // Prevent keeping the process alive
    this.cleanupInterval.unref();
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.windows.get(key);

    // Check if window has expired
    if (!existing || now >= existing.resetTime) {
      const resetTime = now + windowMs;
      this.windows.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }

    // Increment existing window
    existing.count++;
    return { count: existing.count, resetTime: existing.resetTime };
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetTime) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (call when done with the store)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
  }
}

/**
 * Rate limit info stored in request state
 */
export interface RateLimitInfo {
  /** Maximum requests allowed in window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** When the window resets (Unix timestamp) */
  resetTime: number;
  /** Whether the request was rate limited */
  limited: boolean;
}

/**
 * Options for rate limiting middleware
 */
export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed per window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Function to generate a unique key for rate limiting
   * Default: Uses client IP address
   */
  keyGenerator?: (ctx: MiddlewareContext) => string;

  /**
   * Custom store for rate limit data
   * Default: In-memory store
   */
  store?: RateLimitStore;

  /**
   * Custom handler for rate-limited requests
   * Default: Returns 429 Too Many Requests
   */
  onRateLimited?: (ctx: MiddlewareContext, info: RateLimitInfo) => void | Promise<void>;

  /**
   * Skip rate limiting for certain paths
   */
  skipPaths?: string[];

  /**
   * Skip rate limiting based on custom logic
   */
  skip?: (ctx: MiddlewareContext) => boolean | Promise<boolean>;

  /**
   * Include rate limit headers in response
   * @default true
   */
  headers?: boolean;

  /**
   * Custom header names
   */
  headerNames?: {
    limit?: string;
    remaining?: string;
    reset?: string;
    retryAfter?: string;
  };

  /**
   * Message to return when rate limited
   */
  message?: string;
}

// Default in-memory store (shared across middleware instances)
let defaultStore: MemoryRateLimitStore | null = null;

function getDefaultStore(): MemoryRateLimitStore {
  if (!defaultStore) {
    defaultStore = new MemoryRateLimitStore();
  }
  return defaultStore;
}

/**
 * Get client IP from request
 */
function getClientIp(ctx: MiddlewareContext): string {
  const headers = ctx.request.headers;

  // Check common proxy headers
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips?.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? (realIp[0] ?? 'unknown') : realIp;
  }

  // Fall back to socket remote address
  const socket = ctx.request.socket;
  return socket.remoteAddress ?? 'unknown';
}

/**
 * Check if path should skip rate limiting
 */
function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths?.length) return false;
  return skipPaths.some((skipPath) => {
    if (skipPath.endsWith('*')) {
      return path.startsWith(skipPath.slice(0, -1));
    }
    return path === skipPath;
  });
}

/**
 * Default rate limited handler
 */
function defaultOnRateLimited(ctx: MiddlewareContext, info: RateLimitInfo, message: string): void {
  const { response } = ctx;
  const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);

  response.writeHead(429, {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfter),
  });
  response.end(
    JSON.stringify({
      error: 'Too Many Requests',
      message,
      retryAfter,
    }),
  );
}

/**
 * Rate limiting middleware
 *
 * Limits the number of requests from a single client within a time window.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * @example
 * ```typescript
 * import { rateLimit } from '@mcpkit-dev/core';
 *
 * // Basic usage - 100 requests per minute
 * const limiter = rateLimit({
 *   maxRequests: 100,
 *   windowMs: 60000,
 * });
 *
 * // With custom key generator (e.g., by user ID)
 * const userLimiter = rateLimit({
 *   maxRequests: 1000,
 *   windowMs: 3600000, // 1 hour
 *   keyGenerator: (ctx) => {
 *     const auth = ctx.get('mcpkit:auth');
 *     return auth?.principal?.userId ?? getClientIp(ctx);
 *   },
 * });
 *
 * // With Redis store for distributed rate limiting
 * const distributedLimiter = rateLimit({
 *   maxRequests: 100,
 *   store: new RedisRateLimitStore(redisClient),
 * });
 * ```
 */
export function rateLimit(options: RateLimitOptions): Middleware {
  const maxRequests = options.maxRequests;
  const windowMs = options.windowMs ?? 60000;
  const store = options.store ?? getDefaultStore();
  const keyGenerator = options.keyGenerator ?? getClientIp;
  const includeHeaders = options.headers ?? true;
  const message = options.message ?? 'Rate limit exceeded. Please try again later.';

  const headerNames = {
    limit: options.headerNames?.limit ?? 'X-RateLimit-Limit',
    remaining: options.headerNames?.remaining ?? 'X-RateLimit-Remaining',
    reset: options.headerNames?.reset ?? 'X-RateLimit-Reset',
    retryAfter: options.headerNames?.retryAfter ?? 'Retry-After',
  };

  return async (ctx, next) => {
    // Check path skip
    if (shouldSkip(ctx.path, options.skipPaths)) {
      await next();
      return;
    }

    // Check custom skip
    if (options.skip && (await options.skip(ctx))) {
      await next();
      return;
    }

    // Generate rate limit key
    const key = keyGenerator(ctx);

    // Increment counter
    const { count, resetTime } = await store.increment(key, windowMs);

    // Calculate rate limit info
    const info: RateLimitInfo = {
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetTime,
      limited: count > maxRequests,
    };

    // Store info in context for downstream middleware
    ctx.set(STATE_KEYS.RATE_LIMIT, info);

    // Add rate limit headers
    if (includeHeaders) {
      ctx.response.setHeader(headerNames.limit, String(maxRequests));
      ctx.response.setHeader(headerNames.remaining, String(info.remaining));
      ctx.response.setHeader(headerNames.reset, String(Math.ceil(resetTime / 1000)));
    }

    // Check if rate limited
    if (info.limited) {
      if (options.onRateLimited) {
        await options.onRateLimited(ctx, info);
      } else {
        defaultOnRateLimited(ctx, info, message);
      }
      return;
    }

    // Continue to next middleware
    await next();
  };
}
