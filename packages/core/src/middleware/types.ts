import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Context passed to middleware functions
 * Contains request, response, and shared metadata for the request lifecycle
 */
export interface MiddlewareContext {
  /**
   * The incoming HTTP request
   */
  readonly request: IncomingMessage;

  /**
   * The server response object
   */
  readonly response: ServerResponse;

  /**
   * Session ID if using session-based transport
   */
  readonly sessionId?: string;

  /**
   * URL parsed from the request
   */
  readonly url: URL;

  /**
   * HTTP method (GET, POST, etc.)
   */
  readonly method: string;

  /**
   * Request path
   */
  readonly path: string;

  /**
   * Parsed request body (if available)
   */
  body?: unknown;

  /**
   * Shared metadata storage for passing data between middleware
   * Use this to share authentication info, request IDs, etc.
   */
  readonly state: Map<string, unknown>;

  /**
   * Get a typed value from state
   */
  get<T>(key: string): T | undefined;

  /**
   * Set a value in state
   */
  set<T>(key: string, value: T): void;
}

/**
 * Function to call the next middleware in the chain
 */
export type NextFunction = () => Promise<void>;

/**
 * Middleware function signature
 *
 * @param ctx - The middleware context containing request, response, and state
 * @param next - Function to call the next middleware. Must be called for the chain to continue.
 * @returns Promise that resolves when middleware completes
 *
 * @example
 * ```typescript
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.path}`);
 *   const start = Date.now();
 *   await next();
 *   console.log(`Completed in ${Date.now() - start}ms`);
 * };
 * ```
 */
export type Middleware = (ctx: MiddlewareContext, next: NextFunction) => Promise<void>;

/**
 * Options for middleware execution
 */
export interface MiddlewareOptions {
  /**
   * Paths to apply middleware to. If not specified, applies to all paths.
   * Supports exact matches and glob patterns.
   */
  paths?: string[];

  /**
   * Paths to exclude from middleware. Takes precedence over `paths`.
   */
  excludePaths?: string[];

  /**
   * HTTP methods to apply middleware to. If not specified, applies to all methods.
   */
  methods?: string[];

  /**
   * Order priority for middleware execution. Lower numbers run first.
   * @default 100
   */
  order?: number;
}

/**
 * Named middleware with optional configuration
 */
export interface NamedMiddleware {
  /**
   * Unique name for the middleware
   */
  name: string;

  /**
   * The middleware function
   */
  handler: Middleware;

  /**
   * Middleware options
   */
  options?: MiddlewareOptions;
}

/**
 * Middleware that can be passed to the pipeline
 */
export type MiddlewareInput = Middleware | NamedMiddleware;

/**
 * Authentication context stored in middleware state
 */
export interface AuthContext {
  /**
   * Whether the request is authenticated
   */
  authenticated: boolean;

  /**
   * The authenticated principal (user, service, etc.)
   */
  principal?: unknown;

  /**
   * Roles or permissions associated with the principal
   */
  roles?: string[];

  /**
   * Additional claims or attributes
   */
  claims?: Record<string, unknown>;
}

/**
 * Well-known state keys used by built-in middleware
 */
export const STATE_KEYS = {
  AUTH: 'mcpkit:auth',
  REQUEST_ID: 'mcpkit:requestId',
  REQUEST_START: 'mcpkit:requestStart',
  RATE_LIMIT: 'mcpkit:rateLimit',
} as const;

/**
 * Type guard to check if input is a NamedMiddleware
 */
export function isNamedMiddleware(input: MiddlewareInput): input is NamedMiddleware {
  return typeof input === 'object' && 'name' in input && 'handler' in input;
}
