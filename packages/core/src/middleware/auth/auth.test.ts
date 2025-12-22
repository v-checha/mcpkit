import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { MiddlewarePipeline } from '../pipeline.js';
import { type AuthContext, STATE_KEYS } from '../types.js';
import { apiKeyAuth } from './api-key.js';
import { bearerAuth } from './bearer.js';
import { createJwt, jwtAuth } from './jwt.js';

/**
 * Create a mock request
 */
function createMockRequest(
  options: { method?: string; url?: string; headers?: Record<string, string> } = {},
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = options.method ?? 'GET';
  req.url = options.url ?? '/';
  req.headers = {
    host: 'localhost:3000',
    ...options.headers,
  };
  // @ts-expect-error - Mock socket
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}

/**
 * Create a mock response
 */
function createMockResponse(): ServerResponse & {
  _headers: Record<string, string>;
  _statusCode: number;
  _body: string;
} {
  const res = new EventEmitter() as ServerResponse & {
    _headers: Record<string, string>;
    _statusCode: number;
    _body: string;
  };
  res._headers = {};
  res._statusCode = 200;
  res._body = '';

  res.setHeader = (name: string, value: string | number | readonly string[]) => {
    res._headers[name.toLowerCase()] = String(value);
    return res;
  };

  res.writeHead = (statusCode: number, headers?: Record<string, string>) => {
    res._statusCode = statusCode;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        res._headers[k.toLowerCase()] = v;
      }
    }
    return res;
  };

  res.end = (data?: string) => {
    if (data) res._body = data;
    return res;
  };

  // @ts-expect-error - Mock property
  res.headersSent = false;

  return res;
}

describe('apiKeyAuth', () => {
  it('should authenticate with valid API key', async () => {
    const pipeline = new MiddlewarePipeline();
    let authContext: AuthContext | undefined;

    pipeline.use(
      apiKeyAuth({
        validate: (key) => key === 'valid-key',
      }),
    );

    pipeline.use(async (ctx, next) => {
      authContext = ctx.get<AuthContext>(STATE_KEYS.AUTH);
      await next();
    });

    const req = createMockRequest({
      headers: { 'x-api-key': 'valid-key' },
    });
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(authContext).toBeDefined();
    expect(authContext?.authenticated).toBe(true);
  });

  it('should reject missing API key', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      apiKeyAuth({
        validate: (key) => key === 'valid-key',
      }),
    );

    const req = createMockRequest();
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toMatchObject({
      error: 'Unauthorized',
      message: 'API key is required',
    });
  });

  it('should reject invalid API key', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      apiKeyAuth({
        validate: (key) => key === 'valid-key',
      }),
    );

    const req = createMockRequest({
      headers: { 'x-api-key': 'wrong-key' },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toMatchObject({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  });

  it('should read API key from custom header', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      apiKeyAuth({
        header: 'Authorization',
        validate: (key) => key === 'my-secret',
      }),
    );

    const req = createMockRequest({
      headers: { authorization: 'my-secret' },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(true);
  });

  it('should read API key from query parameter', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      apiKeyAuth({
        queryParam: 'apiKey',
        validate: (key) => key === 'query-key',
      }),
    );

    const req = createMockRequest({ url: '/api?apiKey=query-key' });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(true);
  });

  it('should skip authentication for excluded paths', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      apiKeyAuth({
        validate: () => false, // Always reject
        skipPaths: ['/health'],
      }),
    );

    const req = createMockRequest({ url: '/health' });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(true);
  });

  it('should call getPrincipal and store result', async () => {
    const pipeline = new MiddlewarePipeline();
    let authContext: AuthContext | undefined;

    pipeline.use(
      apiKeyAuth({
        validate: (key) => key === 'valid-key',
        getPrincipal: (key) => ({ userId: 'user-123', role: 'admin' }),
      }),
    );

    pipeline.use(async (ctx, next) => {
      authContext = ctx.get<AuthContext>(STATE_KEYS.AUTH);
      await next();
    });

    const req = createMockRequest({
      headers: { 'x-api-key': 'valid-key' },
    });
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(authContext?.principal).toEqual({ userId: 'user-123', role: 'admin' });
  });
});

describe('jwtAuth', () => {
  const secret = 'test-secret-key-that-is-long-enough';

  it('should authenticate with valid JWT', async () => {
    const token = createJwt({ sub: 'user-123', roles: ['admin'] }, secret);
    const pipeline = new MiddlewarePipeline();
    let authContext: AuthContext | undefined;

    pipeline.use(jwtAuth({ secret }));

    pipeline.use(async (ctx, next) => {
      authContext = ctx.get<AuthContext>(STATE_KEYS.AUTH);
      await next();
    });

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(authContext).toBeDefined();
    expect(authContext?.authenticated).toBe(true);
    expect(authContext?.roles).toEqual(['admin']);
    expect(authContext?.claims).toMatchObject({ sub: 'user-123' });
  });

  it('should reject expired JWT', async () => {
    const token = createJwt({ sub: 'user-123' }, secret, { expiresIn: -1 });
    const pipeline = new MiddlewarePipeline();

    pipeline.use(jwtAuth({ secret }));

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body).message).toBe('Token has expired');
  });

  it('should reject JWT with wrong secret', async () => {
    const token = createJwt({ sub: 'user-123' }, 'different-secret-key-that-is-long');
    const pipeline = new MiddlewarePipeline();

    pipeline.use(jwtAuth({ secret }));

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body).message).toBe('Invalid signature');
  });

  it('should validate issuer', async () => {
    const token = createJwt({ sub: 'user-123', iss: 'other-issuer' }, secret);
    const pipeline = new MiddlewarePipeline();

    pipeline.use(jwtAuth({ secret, issuer: 'my-app' }));

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body).message).toBe('Invalid issuer');
  });

  it('should accept valid issuer', async () => {
    const token = createJwt({ sub: 'user-123', iss: 'my-app' }, secret);
    const pipeline = new MiddlewarePipeline();

    pipeline.use(jwtAuth({ secret, issuer: 'my-app' }));

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(true);
  });

  it('should reject missing token', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(jwtAuth({ secret }));

    const req = createMockRequest();
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
  });
});

describe('createJwt', () => {
  const secret = 'test-secret';

  it('should create a valid JWT', () => {
    const token = createJwt({ sub: 'user-123' }, secret);
    const parts = token.split('.');

    expect(parts.length).toBe(3);

    // Decode header
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');

    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    expect(payload.sub).toBe('user-123');
    expect(payload.iat).toBeDefined();
  });

  it('should set expiration time', () => {
    const token = createJwt({ sub: 'user-123' }, secret, { expiresIn: 3600 });
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());

    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('should support different algorithms', () => {
    const tokenHS256 = createJwt({ sub: 'user' }, secret, { algorithm: 'HS256' });
    const tokenHS384 = createJwt({ sub: 'user' }, secret, { algorithm: 'HS384' });
    const tokenHS512 = createJwt({ sub: 'user' }, secret, { algorithm: 'HS512' });

    // All should be valid but different
    expect(tokenHS256).not.toBe(tokenHS384);
    expect(tokenHS384).not.toBe(tokenHS512);
  });
});

describe('bearerAuth', () => {
  it('should authenticate with valid token', async () => {
    const pipeline = new MiddlewarePipeline();
    let authContext: AuthContext | undefined;

    pipeline.use(
      bearerAuth({
        validate: (token) => {
          if (token === 'valid-token') {
            return {
              valid: true,
              principal: { userId: 'user-123' },
              roles: ['user'],
            };
          }
          return { valid: false, error: 'Invalid token' };
        },
      }),
    );

    pipeline.use(async (ctx, next) => {
      authContext = ctx.get<AuthContext>(STATE_KEYS.AUTH);
      await next();
    });

    const req = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(authContext).toBeDefined();
    expect(authContext?.authenticated).toBe(true);
    expect(authContext?.principal).toEqual({ userId: 'user-123' });
    expect(authContext?.roles).toEqual(['user']);
  });

  it('should reject invalid token', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      bearerAuth({
        validate: (token) => ({
          valid: false,
          error: 'Token revoked',
        }),
      }),
    );

    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body).message).toBe('Token revoked');
  });

  it('should support async validation', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      bearerAuth({
        validate: async (token) => {
          // Simulate async database lookup
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            valid: token === 'async-token',
            principal: { userId: 'async-user' },
          };
        },
      }),
    );

    const req = createMockRequest({
      headers: { authorization: 'Bearer async-token' },
    });
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(finalCalled).toBe(true);
  });

  it('should include realm in WWW-Authenticate header', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      bearerAuth({
        realm: 'My API',
        validate: () => ({ valid: false }),
      }),
    );

    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid' },
    });
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(res._headers['www-authenticate']).toBe('Bearer realm="My API"');
  });
});
