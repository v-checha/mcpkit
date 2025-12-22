import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthContext, Middleware, MiddlewareContext } from '../types.js';
import { STATE_KEYS } from '../types.js';

/**
 * JWT header structure
 */
interface JwtHeader {
  alg: string;
  typ?: string;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** Subject (user ID) */
  sub?: string;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string | string[];
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Not before (Unix timestamp) */
  nbf?: number;
  /** Issued at (Unix timestamp) */
  iat?: number;
  /** JWT ID */
  jti?: string;
  /** Custom claims */
  [key: string]: unknown;
}

/**
 * Options for JWT authentication middleware
 */
export interface JwtAuthOptions {
  /**
   * Secret key for HMAC algorithms (HS256, HS384, HS512)
   * For asymmetric algorithms, use the public key
   */
  secret: string | Buffer;

  /**
   * Allowed algorithms
   * @default ['HS256']
   */
  algorithms?: ('HS256' | 'HS384' | 'HS512')[];

  /**
   * Expected issuer (iss claim)
   */
  issuer?: string;

  /**
   * Expected audience (aud claim)
   */
  audience?: string | string[];

  /**
   * Header name to read token from
   * @default 'authorization'
   */
  header?: string;

  /**
   * Token prefix in header (e.g., 'Bearer ')
   * @default 'Bearer '
   */
  tokenPrefix?: string;

  /**
   * Query parameter to read token from (fallback)
   */
  queryParam?: string;

  /**
   * Clock tolerance for expiration checks (in seconds)
   * @default 0
   */
  clockTolerance?: number;

  /**
   * Custom handler for authentication failures
   */
  onUnauthorized?: (ctx: MiddlewareContext, reason: string) => void | Promise<void>;

  /**
   * Skip authentication for certain paths
   */
  skipPaths?: string[];

  /**
   * Transform the decoded payload to a custom principal
   */
  getPrincipal?: (payload: JwtPayload, ctx: MiddlewareContext) => unknown | Promise<unknown>;
}

/**
 * Base64url decode
 */
function base64UrlDecode(str: string): Buffer {
  // Add padding if needed
  const padding = 4 - (str.length % 4);
  if (padding !== 4) {
    str += '='.repeat(padding);
  }
  // Replace URL-safe characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/**
 * Base64url encode
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Get hash algorithm name from JWT algorithm
 */
function getHashAlgorithm(alg: string): string {
  switch (alg) {
    case 'HS256':
      return 'sha256';
    case 'HS384':
      return 'sha384';
    case 'HS512':
      return 'sha512';
    default:
      throw new Error(`Unsupported algorithm: ${alg}`);
  }
}

/**
 * Verify JWT signature
 */
function verifySignature(
  headerB64: string,
  payloadB64: string,
  signature: Buffer,
  secret: string | Buffer,
  algorithm: string,
): boolean {
  const hashAlg = getHashAlgorithm(algorithm);
  const signatureInput = `${headerB64}.${payloadB64}`;

  const expectedSignature = createHmac(hashAlg, secret).update(signatureInput).digest();

  // Use timing-safe comparison to prevent timing attacks
  if (expectedSignature.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Decode and verify a JWT token
 */
function decodeAndVerify(
  token: string,
  secret: string | Buffer,
  options: {
    algorithms: string[];
    issuer?: string;
    audience?: string | string[];
    clockTolerance: number;
  },
): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  // Decode header
  let header: JwtHeader;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf-8')) as JwtHeader;
  } catch {
    throw new Error('Invalid token header');
  }

  // Verify algorithm is allowed
  if (!options.algorithms.includes(header.alg)) {
    throw new Error(`Algorithm ${header.alg} is not allowed`);
  }

  // Decode signature
  const signature = base64UrlDecode(signatureB64);

  // Verify signature
  if (!verifySignature(headerB64, payloadB64, signature, secret, header.alg)) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8')) as JwtPayload;
  } catch {
    throw new Error('Invalid token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockTolerance;

  // Verify expiration
  if (payload.exp !== undefined && now > payload.exp + tolerance) {
    throw new Error('Token has expired');
  }

  // Verify not before
  if (payload.nbf !== undefined && now < payload.nbf - tolerance) {
    throw new Error('Token is not yet valid');
  }

  // Verify issuer
  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error('Invalid issuer');
  }

  // Verify audience
  if (options.audience) {
    const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
    const tokenAudiences = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];

    if (!audiences.some((aud) => tokenAudiences.includes(aud))) {
      throw new Error('Invalid audience');
    }
  }

  return payload;
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
    'WWW-Authenticate': 'Bearer',
  });
  response.end(
    JSON.stringify({
      error: 'Unauthorized',
      message: reason,
    }),
  );
}

/**
 * JWT authentication middleware
 *
 * Validates JWT tokens from request headers.
 * Uses Node.js crypto for signature verification (no external dependencies).
 * Supports HS256, HS384, and HS512 algorithms.
 *
 * @example
 * ```typescript
 * import { jwtAuth } from '@mcpkit-dev/core';
 *
 * const auth = jwtAuth({
 *   secret: process.env.JWT_SECRET,
 *   algorithms: ['HS256'],
 *   issuer: 'my-app',
 * });
 *
 * // Access decoded payload in subsequent middleware
 * const handler = async (ctx, next) => {
 *   const auth = ctx.get('mcpkit:auth');
 *   console.log(auth.principal); // JWT payload or transformed principal
 *   await next();
 * };
 * ```
 */
export function jwtAuth(options: JwtAuthOptions): Middleware {
  const headerName = (options.header ?? 'authorization').toLowerCase();
  const tokenPrefix = options.tokenPrefix ?? 'Bearer ';
  const algorithms = options.algorithms ?? ['HS256'];
  const clockTolerance = options.clockTolerance ?? 0;
  const onUnauthorized = options.onUnauthorized ?? defaultUnauthorized;

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
      await onUnauthorized(ctx, 'Authentication token is required');
      return;
    }

    // Decode and verify token
    let payload: JwtPayload;
    try {
      payload = decodeAndVerify(token, options.secret, {
        algorithms,
        issuer: options.issuer,
        audience: options.audience,
        clockTolerance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      await onUnauthorized(ctx, message);
      return;
    }

    // Get principal
    let principal: unknown = payload;
    if (options.getPrincipal) {
      principal = await options.getPrincipal(payload, ctx);
    }

    // Extract roles from common claim names
    let roles: string[] = [];
    if (Array.isArray(payload.roles)) {
      roles = payload.roles as string[];
    } else if (typeof payload.scope === 'string') {
      roles = payload.scope.split(' ');
    }

    // Store auth context
    const authContext: AuthContext = {
      authenticated: true,
      principal,
      roles,
      claims: payload,
    };
    ctx.set(STATE_KEYS.AUTH, authContext);

    // Continue to next middleware
    await next();
  };
}

/**
 * Create a JWT token (utility function for testing)
 *
 * @example
 * ```typescript
 * const token = createJwt(
 *   { sub: 'user-123', roles: ['admin'] },
 *   'my-secret',
 *   { expiresIn: 3600 }
 * );
 * ```
 */
export function createJwt(
  payload: JwtPayload,
  secret: string | Buffer,
  options?: {
    algorithm?: 'HS256' | 'HS384' | 'HS512';
    expiresIn?: number;
    notBefore?: number;
  },
): string {
  const algorithm = options?.algorithm ?? 'HS256';
  const now = Math.floor(Date.now() / 1000);

  // Build payload with timestamps
  const finalPayload: JwtPayload = {
    ...payload,
    iat: payload.iat ?? now,
  };

  if (options?.expiresIn) {
    finalPayload.exp = now + options.expiresIn;
  }

  if (options?.notBefore) {
    finalPayload.nbf = now + options.notBefore;
  }

  // Encode header
  const header: JwtHeader = { alg: algorithm, typ: 'JWT' };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));

  // Encode payload
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(finalPayload)));

  // Create signature
  const signatureInput = `${headerB64}.${payloadB64}`;
  const hashAlg = getHashAlgorithm(algorithm);
  const signature = createHmac(hashAlg, secret).update(signatureInput).digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
