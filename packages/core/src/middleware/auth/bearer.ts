import type { AuthContext, Middleware, MiddlewareContext } from '../types.js';
import { STATE_KEYS } from '../types.js';

/**
 * Result of bearer token validation
 */
export interface BearerValidationResult {
  /**
   * Whether the token is valid
   */
  valid: boolean;

  /**
   * The authenticated principal (user, service, etc.)
   */
  principal?: unknown;

  /**
   * Roles or permissions
   */
  roles?: string[];

  /**
   * Additional claims or attributes
   */
  claims?: Record<string, unknown>;

  /**
   * Error message if validation failed
   */
  error?: string;
}

/**
 * Options for bearer token authentication middleware
 */
export interface BearerAuthOptions {
  /**
   * Function to validate the bearer token
   * Called with the token (without "Bearer " prefix)
   * Return validation result with principal info
   *
   * This is the main integration point for:
   * - OAuth token introspection
   * - Custom token validation
   * - Database token lookups
   * - External auth service calls
   */
  validate: (
    token: string,
    ctx: MiddlewareContext,
  ) => BearerValidationResult | Promise<BearerValidationResult>;

  /**
   * Header name to read token from
   * @default 'authorization'
   */
  header?: string;

  /**
   * Token prefix in header
   * @default 'Bearer '
   */
  tokenPrefix?: string;

  /**
   * Query parameter to read token from (fallback)
   */
  queryParam?: string;

  /**
   * Custom handler for authentication failures
   */
  onUnauthorized?: (ctx: MiddlewareContext, reason: string) => void | Promise<void>;

  /**
   * Skip authentication for certain paths
   */
  skipPaths?: string[];

  /**
   * Realm for WWW-Authenticate header
   */
  realm?: string;
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
function createDefaultUnauthorized(realm?: string) {
  return (ctx: MiddlewareContext, reason: string): void => {
    const { response } = ctx;
    const wwwAuth = realm ? `Bearer realm="${realm}"` : 'Bearer';
    response.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuth,
    });
    response.end(
      JSON.stringify({
        error: 'Unauthorized',
        message: reason,
      }),
    );
  };
}

/**
 * Bearer token authentication middleware
 *
 * Generic bearer token authentication that delegates validation to a custom function.
 * Useful for OAuth token introspection, custom tokens, or any bearer-style auth.
 *
 * @example
 * ```typescript
 * import { bearerAuth } from '@mcpkit-dev/core';
 *
 * // OAuth token introspection
 * const oauthAuth = bearerAuth({
 *   validate: async (token) => {
 *     const response = await fetch('https://auth.example.com/introspect', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 *       body: `token=${token}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
 *     });
 *     const data = await response.json();
 *     if (data.active) {
 *       return {
 *         valid: true,
 *         principal: { userId: data.sub, email: data.email },
 *         roles: data.scope?.split(' ') ?? [],
 *       };
 *     }
 *     return { valid: false, error: 'Token is not active' };
 *   },
 * });
 *
 * // Simple database token lookup
 * const dbAuth = bearerAuth({
 *   validate: async (token) => {
 *     const record = await db.accessTokens.findUnique({ where: { token } });
 *     if (!record || record.expiresAt < new Date()) {
 *       return { valid: false, error: 'Invalid or expired token' };
 *     }
 *     return {
 *       valid: true,
 *       principal: { userId: record.userId },
 *       roles: record.scopes,
 *     };
 *   },
 * });
 * ```
 */
export function bearerAuth(options: BearerAuthOptions): Middleware {
  const headerName = (options.header ?? 'authorization').toLowerCase();
  const tokenPrefix = options.tokenPrefix ?? 'Bearer ';
  const onUnauthorized = options.onUnauthorized ?? createDefaultUnauthorized(options.realm);

  return async (ctx, next) => {
    // Check if path should skip auth
    if (shouldSkip(ctx.path, options.skipPaths)) {
      await next();
      return;
    }

    // Extract token from header
    let token: string | undefined;
    const authHeader = ctx.request.headers[headerName] as string | undefined;

    if (authHeader) {
      if (tokenPrefix && authHeader.startsWith(tokenPrefix)) {
        token = authHeader.slice(tokenPrefix.length);
      } else if (!tokenPrefix) {
        token = authHeader;
      }
    }

    // Fall back to query parameter
    if (!token && options.queryParam) {
      token = ctx.url.searchParams.get(options.queryParam) ?? undefined;
    }

    // No token provided
    if (!token) {
      await onUnauthorized(ctx, 'Bearer token is required');
      return;
    }

    // Validate token
    let result: BearerValidationResult;
    try {
      result = await options.validate(token, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token validation failed';
      await onUnauthorized(ctx, message);
      return;
    }

    // Check validation result
    if (!result.valid) {
      await onUnauthorized(ctx, result.error ?? 'Invalid token');
      return;
    }

    // Store auth context
    const authContext: AuthContext = {
      authenticated: true,
      principal: result.principal,
      roles: result.roles,
      claims: result.claims,
    };
    ctx.set(STATE_KEYS.AUTH, authContext);

    // Continue to next middleware
    await next();
  };
}
