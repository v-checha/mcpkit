import type { AuthContext, Middleware, MiddlewareContext } from '../types.js';
import { STATE_KEYS } from '../types.js';

/**
 * Options for API key authentication middleware
 */
export interface ApiKeyAuthOptions {
  /**
   * Header name to read API key from
   * @default 'x-api-key'
   */
  header?: string;

  /**
   * Query parameter name to read API key from (fallback if header not found)
   */
  queryParam?: string;

  /**
   * Function to validate the API key
   * Return true if valid, false if invalid
   * Can be async for database lookups
   */
  validate: (key: string, ctx: MiddlewareContext) => boolean | Promise<boolean>;

  /**
   * Optional function to extract principal/user info from a valid key
   * The result is stored in the auth context
   */
  getPrincipal?: (key: string, ctx: MiddlewareContext) => unknown | Promise<unknown>;

  /**
   * Custom handler for authentication failures
   * If not provided, returns 401 Unauthorized
   */
  onUnauthorized?: (ctx: MiddlewareContext, reason: string) => void | Promise<void>;

  /**
   * Skip authentication for certain paths
   * Useful for health check endpoints
   */
  skipPaths?: string[];
}

/**
 * Check if path should skip authentication
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
 * Default unauthorized handler
 */
function defaultUnauthorized(ctx: MiddlewareContext, reason: string): void {
  const { response } = ctx;
  response.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'ApiKey',
  });
  response.end(
    JSON.stringify({
      error: 'Unauthorized',
      message: reason,
    }),
  );
}

/**
 * API Key authentication middleware
 *
 * Validates API keys from request headers or query parameters.
 * On success, stores authentication context in request state.
 *
 * @example
 * ```typescript
 * import { apiKeyAuth } from '@mcpkit-dev/core';
 *
 * const auth = apiKeyAuth({
 *   header: 'x-api-key',
 *   validate: (key) => key === process.env.API_KEY,
 * });
 *
 * // With async validation
 * const dbAuth = apiKeyAuth({
 *   validate: async (key) => {
 *     const result = await db.query('SELECT * FROM api_keys WHERE key = ?', [key]);
 *     return result.length > 0;
 *   },
 *   getPrincipal: async (key) => {
 *     const result = await db.query('SELECT user_id FROM api_keys WHERE key = ?', [key]);
 *     return { userId: result[0].user_id };
 *   },
 * });
 * ```
 */
export function apiKeyAuth(options: ApiKeyAuthOptions): Middleware {
  const headerName = (options.header ?? 'x-api-key').toLowerCase();
  const queryParam = options.queryParam;
  const onUnauthorized = options.onUnauthorized ?? defaultUnauthorized;

  return async (ctx, next) => {
    // Check if path should skip auth
    if (shouldSkip(ctx.path, options.skipPaths)) {
      await next();
      return;
    }

    // Extract API key from header
    let apiKey = ctx.request.headers[headerName] as string | undefined;

    // Fall back to query parameter
    if (!apiKey && queryParam) {
      apiKey = ctx.url.searchParams.get(queryParam) ?? undefined;
    }

    // No API key provided
    if (!apiKey) {
      await onUnauthorized(ctx, 'API key is required');
      return;
    }

    // Validate API key
    const isValid = await options.validate(apiKey, ctx);
    if (!isValid) {
      await onUnauthorized(ctx, 'Invalid API key');
      return;
    }

    // Get principal if configured
    let principal: unknown;
    if (options.getPrincipal) {
      principal = await options.getPrincipal(apiKey, ctx);
    }

    // Store auth context
    const authContext: AuthContext = {
      authenticated: true,
      principal,
    };
    ctx.set(STATE_KEYS.AUTH, authContext);

    // Continue to next middleware
    await next();
  };
}
