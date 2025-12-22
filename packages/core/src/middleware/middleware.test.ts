import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  compose,
  createPipeline,
  type Middleware,
  type MiddlewareContext,
  MiddlewarePipeline,
} from './index.js';

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

describe('MiddlewarePipeline', () => {
  it('should execute middleware in order', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use(async (ctx, next) => {
      order.push(1);
      await next();
      order.push(4);
    });

    pipeline.use(async (ctx, next) => {
      order.push(2);
      await next();
      order.push(3);
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {
      order.push(999);
    });

    expect(order).toEqual([1, 2, 999, 3, 4]);
  });

  it('should short-circuit when next() is not called', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use(async (ctx, next) => {
      order.push(1);
      // Don't call next()
      ctx.response.writeHead(401);
      ctx.response.end('Unauthorized');
    });

    pipeline.use(async (ctx, next) => {
      order.push(2);
      await next();
    });

    const req = createMockRequest();
    const res = createMockResponse();
    let finalCalled = false;

    await pipeline.execute(req, res, undefined, undefined, async () => {
      finalCalled = true;
    });

    expect(order).toEqual([1]);
    expect(finalCalled).toBe(false);
    expect(res._statusCode).toBe(401);
  });

  it('should respect middleware order option', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use({
      name: 'last',
      handler: async (ctx, next) => {
        order.push(3);
        await next();
      },
      options: { order: 300 },
    });

    pipeline.use({
      name: 'first',
      handler: async (ctx, next) => {
        order.push(1);
        await next();
      },
      options: { order: 100 },
    });

    pipeline.use({
      name: 'middle',
      handler: async (ctx, next) => {
        order.push(2);
        await next();
      },
      options: { order: 200 },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(order).toEqual([1, 2, 3]);
  });

  it('should allow sharing state between middleware', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(async (ctx, next) => {
      ctx.set('userId', '12345');
      await next();
    });

    let capturedUserId: string | undefined;
    pipeline.use(async (ctx, next) => {
      capturedUserId = ctx.get<string>('userId');
      await next();
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {});

    expect(capturedUserId).toBe('12345');
  });

  it('should skip middleware based on path exclusion', async () => {
    const pipeline = new MiddlewarePipeline();
    const calls: string[] = [];

    pipeline.use({
      name: 'auth',
      handler: async (ctx, next) => {
        calls.push('auth');
        await next();
      },
      // Use ** for multi-segment matching, * for single segment
      options: { excludePaths: ['/health', '/public/**'] },
    });

    const req1 = createMockRequest({ url: '/health' });
    const res1 = createMockResponse();
    await pipeline.execute(req1, res1, undefined, undefined, async () => {
      calls.push('final1');
    });

    const req2 = createMockRequest({ url: '/public/assets/logo.png' });
    const res2 = createMockResponse();
    await pipeline.execute(req2, res2, undefined, undefined, async () => {
      calls.push('final2');
    });

    const req3 = createMockRequest({ url: '/api/users' });
    const res3 = createMockResponse();
    await pipeline.execute(req3, res3, undefined, undefined, async () => {
      calls.push('final3');
    });

    expect(calls).toEqual(['final1', 'final2', 'auth', 'final3']);
  });

  it('should filter middleware by HTTP method', async () => {
    const pipeline = new MiddlewarePipeline();
    const calls: string[] = [];

    pipeline.use({
      name: 'post-only',
      handler: async (ctx, next) => {
        calls.push('post-handler');
        await next();
      },
      options: { methods: ['POST'] },
    });

    const getReq = createMockRequest({ method: 'GET' });
    const getRes = createMockResponse();
    await pipeline.execute(getReq, getRes, undefined, undefined, async () => {
      calls.push('get-final');
    });

    const postReq = createMockRequest({ method: 'POST' });
    const postRes = createMockResponse();
    await pipeline.execute(postReq, postRes, undefined, undefined, async () => {
      calls.push('post-final');
    });

    expect(calls).toEqual(['get-final', 'post-handler', 'post-final']);
  });

  it('should remove middleware by name', () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use({ name: 'auth', handler: async (_, next) => next() });
    pipeline.use({ name: 'logging', handler: async (_, next) => next() });

    expect(pipeline.size).toBe(2);
    expect(pipeline.has('auth')).toBe(true);

    const removed = pipeline.remove('auth');
    expect(removed).toBe(true);
    expect(pipeline.size).toBe(1);
    expect(pipeline.has('auth')).toBe(false);
  });
});

describe('createPipeline', () => {
  it('should create a new pipeline instance', () => {
    const pipeline = createPipeline();
    expect(pipeline).toBeInstanceOf(MiddlewarePipeline);
  });
});

describe('compose', () => {
  it('should compose multiple middleware into one', async () => {
    const order: number[] = [];

    const middleware1: Middleware = async (ctx, next) => {
      order.push(1);
      await next();
      order.push(4);
    };

    const middleware2: Middleware = async (ctx, next) => {
      order.push(2);
      await next();
      order.push(3);
    };

    const composed = compose(middleware1, middleware2);

    const pipeline = new MiddlewarePipeline();
    pipeline.use(composed);

    const req = createMockRequest();
    const res = createMockResponse();

    await pipeline.execute(req, res, undefined, undefined, async () => {
      order.push(999);
    });

    expect(order).toEqual([1, 2, 999, 3, 4]);
  });
});

describe('MiddlewareContext', () => {
  it('should correctly parse URL and path', async () => {
    const pipeline = new MiddlewarePipeline();
    let capturedCtx: MiddlewareContext | undefined;

    pipeline.use(async (ctx, next) => {
      capturedCtx = ctx;
      await next();
    });

    const req = createMockRequest({ url: '/api/users?page=1&limit=10' });
    const res = createMockResponse();

    await pipeline.execute(req, res, 'session-123', { data: 'test' }, async () => {});

    expect(capturedCtx).toBeDefined();
    expect(capturedCtx?.path).toBe('/api/users');
    expect(capturedCtx?.method).toBe('GET');
    expect(capturedCtx?.sessionId).toBe('session-123');
    expect(capturedCtx?.body).toEqual({ data: 'test' });
    expect(capturedCtx?.url.searchParams.get('page')).toBe('1');
    expect(capturedCtx?.url.searchParams.get('limit')).toBe('10');
  });
});
