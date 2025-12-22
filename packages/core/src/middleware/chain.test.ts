/**
 * Middleware chain enhancement tests
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
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
import type { Middleware, MiddlewareContext } from './types.js';

/**
 * Create a mock middleware context for testing
 */
function createMockContext(overrides?: Partial<MiddlewareContext>): MiddlewareContext {
  const state = new Map<string, unknown>();
  return {
    request: {} as IncomingMessage,
    response: {
      headersSent: false,
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse,
    sessionId: 'test-session',
    url: new URL('http://localhost/test'),
    method: 'GET',
    path: '/test',
    body: undefined,
    state,
    get<T>(key: string): T | undefined {
      return state.get(key) as T | undefined;
    },
    set<T>(key: string, value: T): void {
      state.set(key, value);
    },
    ...overrides,
  };
}

describe('Middleware Chain Enhancements', () => {
  describe('conditional', () => {
    it('should run middleware when condition is true', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());
      const condMw = conditional(middleware, {
        when: () => true,
      });

      const ctx = createMockContext();
      const next = vi.fn();

      await condMw(ctx, next);

      expect(middleware).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip middleware when condition is false', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());
      const condMw = conditional(middleware, {
        when: () => false,
      });

      const ctx = createMockContext();
      const next = vi.fn();

      await condMw(ctx, next);

      expect(middleware).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should run otherwise middleware when condition is false', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());
      const otherwise = vi.fn<Middleware>(async (_ctx, next) => await next());

      const condMw = conditional(middleware, {
        when: () => false,
        otherwise,
      });

      const ctx = createMockContext();
      const next = vi.fn();

      await condMw(ctx, next);

      expect(middleware).not.toHaveBeenCalled();
      expect(otherwise).toHaveBeenCalled();
    });

    it('should support async conditions', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());
      const condMw = conditional(middleware, {
        when: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return true;
        },
      });

      const ctx = createMockContext();
      const next = vi.fn();

      await condMw(ctx, next);

      expect(middleware).toHaveBeenCalled();
    });
  });

  describe('withTimeout', () => {
    it('should complete normally within timeout', async () => {
      const middleware: Middleware = async (_ctx, next) => {
        await new Promise((r) => setTimeout(r, 10));
        await next();
      };

      const timeoutMw = withTimeout(middleware, { ms: 100 });
      const ctx = createMockContext();
      const next = vi.fn();

      await timeoutMw(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('should timeout slow middleware', async () => {
      const middleware: Middleware = async (_ctx, next) => {
        await new Promise((r) => setTimeout(r, 200));
        await next();
      };

      const timeoutMw = withTimeout(middleware, { ms: 50 });
      const ctx = createMockContext();
      const next = vi.fn();

      await timeoutMw(ctx, next);

      expect(ctx.response.writeHead).toHaveBeenCalledWith(408, expect.any(Object));
    });

    it('should call custom onTimeout handler', async () => {
      const onTimeout = vi.fn();
      const middleware: Middleware = async () => {
        await new Promise((r) => setTimeout(r, 200));
      };

      const timeoutMw = withTimeout(middleware, {
        ms: 50,
        onTimeout,
      });

      const ctx = createMockContext();
      await timeoutMw(ctx, vi.fn());

      expect(onTimeout).toHaveBeenCalledWith(ctx);
    });
  });

  describe('withErrorHandler', () => {
    it('should pass through on success', async () => {
      const middleware: Middleware = async (_ctx, next) => await next();
      const safeMw = withErrorHandler(middleware);

      const ctx = createMockContext();
      const next = vi.fn();

      await safeMw(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('should catch and handle errors', async () => {
      const middleware: Middleware = async () => {
        throw new Error('Test error');
      };

      const safeMw = withErrorHandler(middleware, { log: false });
      const ctx = createMockContext();
      const next = vi.fn();

      await safeMw(ctx, next);

      expect(ctx.response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    });

    it('should use custom error handler', async () => {
      const handler = vi.fn();
      const middleware: Middleware = async () => {
        throw new Error('Test error');
      };

      const safeMw = withErrorHandler(middleware, { handler, log: false });
      const ctx = createMockContext();

      await safeMw(ctx, vi.fn());

      expect(handler).toHaveBeenCalled();
    });

    it('should format errors using formatError', async () => {
      const middleware: Middleware = async () => {
        throw new Error('Test error');
      };

      const safeMw = withErrorHandler(middleware, {
        log: false,
        formatError: (err) => ({ code: 'ERR', message: err.message }),
      });

      const ctx = createMockContext();
      await safeMw(ctx, vi.fn());

      expect(ctx.response.end).toHaveBeenCalledWith(expect.stringContaining('"code":"ERR"'));
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());
      const retryMw = withRetry(middleware);

      const ctx = createMockContext();
      const next = vi.fn();

      await retryMw(ctx, next);

      expect(middleware).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const middleware: Middleware = async (_ctx, next) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Fail');
        }
        await next();
      };

      const retryMw = withRetry(middleware, { attempts: 3, delay: 10 });
      const ctx = createMockContext();
      const next = vi.fn();

      await retryMw(ctx, next);

      expect(attempts).toBe(3);
      expect(next).toHaveBeenCalled();
    });

    it('should throw after max attempts', async () => {
      const middleware: Middleware = async () => {
        throw new Error('Always fails');
      };

      const retryMw = withRetry(middleware, { attempts: 2, delay: 10 });
      const ctx = createMockContext();

      await expect(retryMw(ctx, vi.fn())).rejects.toThrow('Always fails');
    });

    it('should call onRetry callback', async () => {
      let attempts = 0;
      const onRetry = vi.fn();
      const middleware: Middleware = async (_ctx, next) => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Fail');
        }
        await next();
      };

      const retryMw = withRetry(middleware, { attempts: 3, delay: 10, onRetry });
      const ctx = createMockContext();

      await retryMw(ctx, vi.fn());

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should respect shouldRetry predicate', async () => {
      const middleware: Middleware = async () => {
        throw new Error('Non-retryable');
      };

      const retryMw = withRetry(middleware, {
        attempts: 3,
        delay: 10,
        shouldRetry: (err) => err.message !== 'Non-retryable',
      });

      const ctx = createMockContext();

      await expect(retryMw(ctx, vi.fn())).rejects.toThrow('Non-retryable');
    });
  });

  describe('createMiddlewareGroup', () => {
    it('should create a named middleware', () => {
      const group = createMiddlewareGroup({
        name: 'test-group',
        middleware: [async (_ctx, next) => await next()],
      });

      expect(group.name).toBe('test-group');
      expect(typeof group.handler).toBe('function');
    });

    it('should compose multiple middleware', async () => {
      const order: number[] = [];

      const group = createMiddlewareGroup({
        name: 'test-group',
        middleware: [
          async (_ctx, next) => {
            order.push(1);
            await next();
          },
          async (_ctx, next) => {
            order.push(2);
            await next();
          },
          async (_ctx, next) => {
            order.push(3);
            await next();
          },
        ],
      });

      const ctx = createMockContext();
      const next = vi.fn();

      await group.handler(ctx, next);

      expect(order).toEqual([1, 2, 3]);
      expect(next).toHaveBeenCalled();
    });

    it('should set order priority', () => {
      const group = createMiddlewareGroup({
        name: 'test-group',
        middleware: [],
        order: 10,
      });

      expect(group.options?.order).toBe(10);
    });
  });

  describe('withHooks', () => {
    it('should call before hook', async () => {
      const before = vi.fn();
      const middleware: Middleware = async (_ctx, next) => await next();

      const hookedMw = withHooks(middleware, { before });
      const ctx = createMockContext();

      await hookedMw(ctx, vi.fn());

      expect(before).toHaveBeenCalledWith(ctx);
    });

    it('should call after hook on success', async () => {
      const after = vi.fn();
      const middleware: Middleware = async (_ctx, next) => await next();

      const hookedMw = withHooks(middleware, { after });
      const ctx = createMockContext();

      await hookedMw(ctx, vi.fn());

      expect(after).toHaveBeenCalledWith(ctx);
    });

    it('should call onError hook on failure', async () => {
      const onError = vi.fn();
      const middleware: Middleware = async () => {
        throw new Error('Test error');
      };

      const hookedMw = withHooks(middleware, { onError });
      const ctx = createMockContext();

      await expect(hookedMw(ctx, vi.fn())).rejects.toThrow('Test error');
      expect(onError).toHaveBeenCalled();
    });

    it('should call finally hook always', async () => {
      const finallyHook = vi.fn();
      const middleware: Middleware = async () => {
        throw new Error('Test error');
      };

      const hookedMw = withHooks(middleware, { finally: finallyHook });
      const ctx = createMockContext();

      await expect(hookedMw(ctx, vi.fn())).rejects.toThrow();
      expect(finallyHook).toHaveBeenCalled();
    });
  });

  describe('parallelMiddleware', () => {
    it('should run all middleware in parallel', async () => {
      const times: number[] = [];
      const start = Date.now();

      const mw1: Middleware = async () => {
        await new Promise((r) => setTimeout(r, 50));
        times.push(Date.now() - start);
      };

      const mw2: Middleware = async () => {
        await new Promise((r) => setTimeout(r, 50));
        times.push(Date.now() - start);
      };

      const parallelMw = parallelMiddleware([mw1, mw2]);
      const ctx = createMockContext();
      const next = vi.fn();

      await parallelMw(ctx, next);

      // Both should complete around the same time (parallel)
      expect(times[0]).toBeLessThan(100);
      expect(times[1]).toBeLessThan(100);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('selectMiddleware', () => {
    it('should select correct middleware based on selector', async () => {
      const apiHandler = vi.fn<Middleware>(async (_ctx, next) => await next());
      const webHandler = vi.fn<Middleware>(async (_ctx, next) => await next());

      const selectMw = selectMiddleware((ctx) => (ctx.path.startsWith('/api') ? 'api' : 'web'), {
        api: apiHandler,
        web: webHandler,
      });

      const apiCtx = createMockContext({ path: '/api/users' });
      const webCtx = createMockContext({ path: '/home' });

      await selectMw(apiCtx, vi.fn());
      await selectMw(webCtx, vi.fn());

      expect(apiHandler).toHaveBeenCalledWith(apiCtx, expect.any(Function));
      expect(webHandler).toHaveBeenCalledWith(webCtx, expect.any(Function));
    });

    it('should use fallback when no match', async () => {
      const fallback = vi.fn<Middleware>(async (_ctx, next) => await next());

      const selectMw = selectMiddleware(
        () => 'unknown' as 'api',
        { api: async (_ctx, next) => await next() },
        fallback,
      );

      const ctx = createMockContext();
      await selectMw(ctx, vi.fn());

      expect(fallback).toHaveBeenCalled();
    });

    it('should support async selectors', async () => {
      const handler = vi.fn<Middleware>(async (_ctx, next) => await next());

      const selectMw = selectMiddleware(
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 'test';
        },
        { test: handler },
      );

      const ctx = createMockContext();
      await selectMw(ctx, vi.fn());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('withCache', () => {
    it('should cache successful middleware runs', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());

      const cachedMw = withCache(middleware, {
        getKey: (ctx) => ctx.path,
        ttl: 1000,
      });

      const ctx = createMockContext({ path: '/test' });

      // First call
      await cachedMw(ctx, vi.fn());
      expect(middleware).toHaveBeenCalledTimes(1);

      // Second call - should be cached
      await cachedMw(ctx, vi.fn());
      expect(middleware).toHaveBeenCalledTimes(1);
    });

    it('should cache different keys separately', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());

      const cachedMw = withCache(middleware, {
        getKey: (ctx) => ctx.path,
        ttl: 1000,
      });

      await cachedMw(createMockContext({ path: '/a' }), vi.fn());
      await cachedMw(createMockContext({ path: '/b' }), vi.fn());

      expect(middleware).toHaveBeenCalledTimes(2);
    });

    it('should respect ttl', async () => {
      const middleware = vi.fn<Middleware>(async (_ctx, next) => await next());

      const cachedMw = withCache(middleware, {
        getKey: (ctx) => ctx.path,
        ttl: 50,
      });

      const ctx = createMockContext({ path: '/test' });

      await cachedMw(ctx, vi.fn());
      expect(middleware).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 60));

      await cachedMw(ctx, vi.fn());
      expect(middleware).toHaveBeenCalledTimes(2);
    });
  });

  describe('TimeoutError', () => {
    it('should be instanceof Error', () => {
      const error = new TimeoutError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TimeoutError');
    });
  });
});
