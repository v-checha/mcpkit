/**
 * Authentication middleware for HTTP transports
 *
 * Provides multiple authentication strategies:
 * - API Key: Simple header/query-based authentication
 * - JWT: JSON Web Token authentication with HMAC signing
 * - Bearer: Generic OAuth/token-based authentication
 *
 * @example
 * ```typescript
 * import { apiKeyAuth, jwtAuth, bearerAuth } from '@mcpkit-dev/core';
 *
 * // API Key authentication
 * const apiKey = apiKeyAuth({
 *   validate: (key) => key === process.env.API_KEY
 * });
 *
 * // JWT authentication
 * const jwt = jwtAuth({
 *   secret: process.env.JWT_SECRET,
 *   issuer: 'my-app'
 * });
 *
 * // OAuth bearer token
 * const oauth = bearerAuth({
 *   validate: async (token) => {
 *     // Introspect token with OAuth server
 *     return { valid: true, principal: { userId: '123' } };
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

export { apiKeyAuth, type ApiKeyAuthOptions } from './api-key.js';
export { bearerAuth, type BearerAuthOptions, type BearerValidationResult } from './bearer.js';
export { createJwt, jwtAuth, type JwtAuthOptions, type JwtPayload } from './jwt.js';
