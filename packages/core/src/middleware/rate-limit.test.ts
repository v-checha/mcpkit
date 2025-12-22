import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiddlewarePipeline } from './pipeline.js';
import { MemoryRateLimitStore, type RateLimitInfo, rateLimit } from './rate-limit.js';
import { STATE_KEYS } from './types.js';

/**
 * Create a mock request
 */
function createMockRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    remoteAddress?: string;
  } = {},
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = options.method ?? 'GET';
  req.url = options.url ?? '/';
  req.headers = {
    host: 'localhost:3000',
    ...options.headers,
  };
  // @ts-expect-error - Mock socket
  req.socket = { remoteAddress: options.remoteAddress ?? '127.0.0.1' };
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

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.destroy();
  });

  it('should increment counter for new key', async () => {
    const result = await store.increment('user-1', 60000);

    expect(result.count).toBe(1);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('should increment counter for existing key', async () => {
    await store.increment('user-1', 60000);
    await store.increment('user-1', 60000);
    const result = await store.increment('user-1', 60000);

    expect(result.count).toBe(3);
  });

  it('should reset counter after window expires', async () => {
    // Use a very short window
    const windowMs = 50;
    await store.increment('user-1', windowMs);
    await store.increment('user-1', windowMs);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = await store.increment('user-1', windowMs);
    expect(result.count).toBe(1);
  });

  it('should track different keys separately', async () => {
    await store.increment('user-1', 60000);
    await store.increment('user-1', 60000);
    await store.increment('user-2', 60000);

    const result1 = await store.increment('user-1', 60000);
    const result2 = await store.increment('user-2', 60000);

    expect(result1.count).toBe(3);
    expect(result2.count).toBe(2);
  });

  it('should reset a specific key', async () => {
    await store.increment('user-1', 60000);
    await store.increment('user-1', 60000);
    await store.reset('user-1');

    const result = await store.increment('user-1', 60000);
    expect(result.count).toBe(1);
  });
});

describe('rateLimit middleware', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.destroy();
  });

  it('should allow requests under the limit', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 5,
        windowMs: 60000,
        store,
      }),
    );

    const requests = [];
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest();
      const res = createMockResponse();
      let finalCalled = false;

      await pipeline.execute(req, res, undefined, undefined, async () => {
        finalCalled = true;
      });

      requests.push({ finalCalled, status: res._statusCode });
    }

    expect(requests.every((r) => r.finalCalled)).toBe(true);
    expect(requests.every((r) => r.status === 200)).toBe(true);
  });

  it('should block requests over the limit', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 2,
        windowMs: 60000,
        store,
      }),
    );

    // Make 3 requests (limit is 2)
    const results = [];
    for (let i = 0; i < 3; i++) {
      const req = createMockRequest();
      const res = createMockResponse();
      let finalCalled = false;

      await pipeline.execute(req, res, undefined, undefined, async () => {
        finalCalled = true;
      });

      results.push({ finalCalled, status: res._statusCode });
    }

    // First 2 should succeed
    expect(results[0]?.finalCalled).toBe(true);
    expect(results[1]?.finalCalled).toBe(true);

    // Third should be blocked
    expect(results[2]?.finalCalled).toBe(false);
    expect(results[2]?.status).toBe(429);
  });

  it('should include rate limit headers', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 10,
        windowMs: 60000,
        store,
      }),
    );

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(res._headers['x-ratelimit-limit']).toBe('10');
    expect(res._headers['x-ratelimit-remaining']).toBe('9');
    expect(res._headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should use custom key generator', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 2,
        windowMs: 60000,
        store,
        keyGenerator: (ctx) => (ctx.request.headers['x-user-id'] as string) ?? 'anonymous',
      }),
    );

    // Requests from user-1
    for (let i = 0; i < 2; i++) {
      const req = createMockRequest({ headers: { 'x-user-id': 'user-1' } });
      const res = createMockResponse();
      await pipeline.execute(req, res, undefined, undefined, async () => {});
    }

    // Third request from user-1 should be blocked
    const req1 = createMockRequest({ headers: { 'x-user-id': 'user-1' } });
    const res1 = createMockResponse();
    let user1Blocked = false;
    await pipeline.execute(req1, res1, undefined, undefined, async () => {
      user1Blocked = true;
    });

    // But user-2 should still be allowed
    const req2 = createMockRequest({ headers: { 'x-user-id': 'user-2' } });
    const res2 = createMockResponse();
    let user2Allowed = false;
    await pipeline.execute(req2, res2, undefined, undefined, async () => {
      user2Allowed = true;
    });

    expect(user1Blocked).toBe(false);
    expect(res1._statusCode).toBe(429);
    expect(user2Allowed).toBe(true);
  });

  it('should skip rate limiting for excluded paths', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 1,
        windowMs: 60000,
        store,
        skipPaths: ['/health'],
      }),
    );

    // Use the one allowed request
    const req1 = createMockRequest({ url: '/api' });
    const res1 = createMockResponse();
    await pipeline.execute(req1, res1, undefined, undefined, async () => {});

    // Health check should still work
    const req2 = createMockRequest({ url: '/health' });
    const res2 = createMockResponse();
    let healthAllowed = false;
    await pipeline.execute(req2, res2, undefined, undefined, async () => {
      healthAllowed = true;
    });

    expect(healthAllowed).toBe(true);
  });

  it('should store rate limit info in context', async () => {
    const pipeline = new MiddlewarePipeline();
    let rateLimitInfo: RateLimitInfo | undefined;

    pipeline.use(
      rateLimit({
        maxRequests: 10,
        windowMs: 60000,
        store,
      }),
    );

    pipeline.use(async (ctx, next) => {
      rateLimitInfo = ctx.get<RateLimitInfo>(STATE_KEYS.RATE_LIMIT);
      await next();
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(rateLimitInfo).toBeDefined();
    expect(rateLimitInfo?.limit).toBe(10);
    expect(rateLimitInfo?.remaining).toBe(9);
    expect(rateLimitInfo?.limited).toBe(false);
  });

  it('should call custom onRateLimited handler', async () => {
    const pipeline = new MiddlewarePipeline();
    const onRateLimited = vi.fn((ctx, info) => {
      ctx.response.writeHead(429, { 'Content-Type': 'text/plain' });
      ctx.response.end('Custom rate limit message');
    });

    pipeline.use(
      rateLimit({
        maxRequests: 1,
        windowMs: 60000,
        store,
        onRateLimited,
      }),
    );

    // First request OK
    const req1 = createMockRequest();
    const res1 = createMockResponse();
    await pipeline.execute(req1, res1, undefined, undefined, async () => {});

    // Second request should trigger custom handler
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    await pipeline.execute(req2, res2, undefined, undefined, async () => {});

    expect(onRateLimited).toHaveBeenCalled();
    expect(res2._body).toBe('Custom rate limit message');
  });

  it('should use X-Forwarded-For header for IP detection', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 1,
        windowMs: 60000,
        store,
      }),
    );

    // Request from proxy with X-Forwarded-For
    const req1 = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
    });
    const res1 = createMockResponse();
    await pipeline.execute(req1, res1, undefined, undefined, async () => {});

    // Second request from same forwarded IP should be blocked
    const req2 = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.2' },
    });
    const res2 = createMockResponse();
    let blocked = false;
    await pipeline.execute(req2, res2, undefined, undefined, async () => {
      blocked = true;
    });

    expect(blocked).toBe(false);
    expect(res2._statusCode).toBe(429);
  });

  it('should skip rate limiting with custom skip function', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(
      rateLimit({
        maxRequests: 1,
        windowMs: 60000,
        store,
        skip: (ctx) => ctx.request.headers['x-bypass'] === 'true',
      }),
    );

    // Use the one allowed request
    const req1 = createMockRequest();
    const res1 = createMockResponse();
    await pipeline.execute(req1, res1, undefined, undefined, async () => {});

    // Request with bypass header should skip rate limiting
    const req2 = createMockRequest({ headers: { 'x-bypass': 'true' } });
    const res2 = createMockResponse();
    let bypassed = false;
    await pipeline.execute(req2, res2, undefined, undefined, async () => {
      bypassed = true;
    });

    expect(bypassed).toBe(true);
  });
});
