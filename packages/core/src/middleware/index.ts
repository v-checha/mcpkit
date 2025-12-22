/**
 * Middleware system for HTTP transports
 *
 * Provides composable middleware for authentication, rate limiting,
 * logging, and other cross-cutting concerns.
 *
 * @example
 * ```typescript
 * import { MiddlewarePipeline, apiKeyAuth, rateLimit } from '@mcpkit-dev/core';
 *
 * const pipeline = new MiddlewarePipeline();
 *
 * pipeline.use(apiKeyAuth({
 *   header: 'x-api-key',
 *   validate: (key) => key === process.env.API_KEY
 * }));
 *
 * pipeline.use(rateLimit({
 *   maxRequests: 100,
 *   windowMs: 60000
 * }));
 * ```
 *
 * @packageDocumentation
 */

// Auth middleware
export {
  apiKeyAuth,
  type ApiKeyAuthOptions,
  bearerAuth,
  type BearerAuthOptions,
  type BearerValidationResult,
  createJwt,
  jwtAuth,
  type JwtAuthOptions,
  type JwtPayload,
} from './auth/index.js';

// Pipeline
export {
  compose,
  createPipeline,
  MiddlewarePipeline,
} from './pipeline.js';

// Rate limiting
export {
  MemoryRateLimitStore,
  rateLimit,
  type RateLimitInfo,
  type RateLimitOptions,
  type RateLimitStore,
} from './rate-limit.js';

// Tracing
export {
  advancedTracing,
  CORRELATION_ID_KEY,
  getCorrelationId,
  getTraceContext,
  TRACE_CONTEXT_KEY,
  TraceContext,
  tracing,
} from './tracing.js';

export type {
  TracingOptions,
  TraceSpan,
} from './tracing.js';

// Middleware chain enhancements
export {
  conditional,
  createMiddlewareGroup,
  parallelMiddleware,
  selectMiddleware,
  TimeoutError,
  withCache,
  withErrorHandler,
  withHooks,
  withRetry,
  withTimeout,
} from './chain.js';

export type {
  CacheOptions,
  ConditionalOptions,
  ErrorHandlerOptions,
  MiddlewareGroupOptions,
  MiddlewareHooksOptions,
  RetryOptions,
  TimeoutOptions,
} from './chain.js';

// Types
export type {
  AuthContext,
  Middleware,
  MiddlewareContext,
  MiddlewareInput,
  MiddlewareOptions,
  NamedMiddleware,
  NextFunction,
} from './types.js';

export {
  isNamedMiddleware,
  STATE_KEYS,
} from './types.js';
