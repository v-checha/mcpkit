import 'reflect-metadata';
import { type AuthContext, STATE_KEYS } from '../middleware/types.js';

/**
 * Metadata key for RequireAuth options
 */
const REQUIRE_AUTH_KEY = Symbol('mcpkit:requireAuth');

/**
 * Options for the @RequireAuth decorator
 */
export interface RequireAuthOptions {
  /**
   * Required roles (any match will pass)
   */
  roles?: string[];

  /**
   * Required claims (all must match)
   */
  claims?: Record<string, unknown>;

  /**
   * Custom validation function
   * @param authContext - The authentication context
   * @returns Whether the request is authorized
   */
  validate?: (authContext: AuthContext) => boolean | Promise<boolean>;

  /**
   * Custom error message when auth fails
   */
  message?: string;
}

/**
 * Method decorator that requires authentication for a tool, resource, or prompt
 *
 * This decorator marks a method as requiring authentication. When the method is
 * called, it will check for an AuthContext in the middleware state and validate
 * that the user is authenticated and optionally has the required roles/claims.
 *
 * Note: This decorator works in conjunction with authentication middleware (e.g.,
 * `jwtAuth`, `apiKeyAuth`, `bearerAuth`). The middleware must set the AuthContext
 * in the middleware state for this decorator to function properly.
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'my-server', version: '1.0.0' })
 * class MyServer {
 *   // Simple authentication requirement
 *   @Tool({ description: 'Protected tool' })
 *   @RequireAuth()
 *   async protectedTool(@Param({ name: 'data' }) data: string) {
 *     return `Protected: ${data}`;
 *   }
 *
 *   // Role-based access control
 *   @Tool({ description: 'Admin only operation' })
 *   @RequireAuth({ roles: ['admin'] })
 *   async adminTool(@Param({ name: 'data' }) data: string) {
 *     return `Admin: ${data}`;
 *   }
 *
 *   // Custom validation
 *   @Tool({ description: 'Custom auth' })
 *   @RequireAuth({
 *     validate: (auth) => auth.claims?.subscription === 'premium',
 *     message: 'Premium subscription required',
 *   })
 *   async premiumTool(@Param({ name: 'data' }) data: string) {
 *     return `Premium: ${data}`;
 *   }
 * }
 * ```
 *
 * @param options - Configuration options for authorization
 */
export function RequireAuth(options: RequireAuthOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Store metadata for inspection
    const key = `${REQUIRE_AUTH_KEY.toString()}:${String(propertyKey)}`;
    Reflect.defineMetadata(key, options, target);

    // Store in class-level metadata for bootstrap access
    const existingAuth = Reflect.getMetadata(REQUIRE_AUTH_KEY, target) ?? [];
    existingAuth.push({
      propertyKey,
      options,
    });
    Reflect.defineMetadata(REQUIRE_AUTH_KEY, existingAuth, target);

    const originalMethod = descriptor.value;

    if (typeof originalMethod === 'function') {
      descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
        // Try to get auth context from metadata or global context
        const authContext = getAuthContextFromRequest();

        // Validate authentication
        await validateAuth(authContext, options, String(propertyKey));

        // Call original method
        return originalMethod.apply(this, args);
      };
    }
  };
}

/**
 * Get RequireAuth options for a method
 */
export function getRequireAuthOptions(
  target: object,
  propertyKey: string | symbol,
): RequireAuthOptions | undefined {
  const key = `${REQUIRE_AUTH_KEY.toString()}:${String(propertyKey)}`;
  return Reflect.getMetadata(key, target);
}

/**
 * Get all methods with RequireAuth decorator
 */
export function getRequireAuthMetadata(
  target: object,
): Array<{ propertyKey: string | symbol; options: RequireAuthOptions }> {
  return Reflect.getMetadata(REQUIRE_AUTH_KEY, target) ?? [];
}

/**
 * Check if a method requires authentication
 */
export function isAuthRequired(target: object, propertyKey: string | symbol): boolean {
  return getRequireAuthOptions(target, propertyKey) !== undefined;
}

/**
 * Authorization error thrown when authentication/authorization fails
 */
export class AuthorizationError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'UNAUTHORIZED';

  constructor(message: string, code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

/**
 * Global auth context storage for request-scoped authentication
 * Uses AsyncLocalStorage pattern for thread-safe request context
 */
let currentAuthContext: AuthContext | undefined;

/**
 * Set the current auth context (called by middleware/transport)
 * @internal
 */
export function setAuthContext(ctx: AuthContext | undefined): void {
  currentAuthContext = ctx;
}

/**
 * Get the current auth context
 * @internal
 */
export function getAuthContext(): AuthContext | undefined {
  return currentAuthContext;
}

/**
 * Get auth context from the current request
 */
function getAuthContextFromRequest(): AuthContext | undefined {
  // Return the current auth context
  return currentAuthContext;
}

/**
 * Validate auth context against options
 */
async function validateAuth(
  authContext: AuthContext | undefined,
  options: RequireAuthOptions,
  methodName: string,
): Promise<void> {
  const errorMessage = options.message ?? `Authentication required for ${methodName}`;

  // Check if authenticated
  if (!authContext || !authContext.authenticated) {
    throw new AuthorizationError(errorMessage, 'UNAUTHENTICATED');
  }

  // Check roles if specified
  if (options.roles && options.roles.length > 0) {
    const userRoles = authContext.roles ?? [];
    const hasRole = options.roles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new AuthorizationError(
        options.message ?? `Insufficient role. Required: ${options.roles.join(' or ')}`,
        'UNAUTHORIZED',
      );
    }
  }

  // Check claims if specified
  if (options.claims) {
    const userClaims = authContext.claims ?? {};
    for (const [key, value] of Object.entries(options.claims)) {
      if (userClaims[key] !== value) {
        throw new AuthorizationError(
          options.message ?? `Required claim ${key} not found or invalid`,
          'UNAUTHORIZED',
        );
      }
    }
  }

  // Custom validation
  if (options.validate) {
    const isValid = await options.validate(authContext);
    if (!isValid) {
      throw new AuthorizationError(
        options.message ?? 'Authorization validation failed',
        'UNAUTHORIZED',
      );
    }
  }
}

/**
 * Utility to create an auth context
 */
export function createAuthContext(
  principal: unknown,
  options?: {
    roles?: string[];
    claims?: Record<string, unknown>;
  },
): AuthContext {
  return {
    authenticated: true,
    principal,
    roles: options?.roles,
    claims: options?.claims,
  };
}

/**
 * Utility to create an unauthenticated context
 */
export function unauthenticatedContext(): AuthContext {
  return {
    authenticated: false,
  };
}

/**
 * Run a function with a specific auth context
 * Useful for testing or programmatic context switching
 */
export async function withAuthContext<T>(
  context: AuthContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  const previous = currentAuthContext;
  try {
    currentAuthContext = context;
    return await fn();
  } finally {
    currentAuthContext = previous;
  }
}

/**
 * State key for auth context (re-export for convenience)
 */
export const AUTH_STATE_KEY = STATE_KEYS.AUTH;
