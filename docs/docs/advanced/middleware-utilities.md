---
sidebar_position: 2
---

# Middleware Utilities

MCPKit provides powerful utilities for composing, enhancing, and organizing middleware. This guide covers advanced patterns beyond basic middleware creation.

## Middleware Chain Utilities

### conditional() - Conditional Execution

Run middleware only when a condition is met:

```typescript
import { conditional } from '@mcpkit-dev/core';

// Only run auth for non-public paths
const authMiddleware = conditional(
  (ctx) => !ctx.path.startsWith('/public'),
  jwtAuth({ secret: process.env.JWT_SECRET! })
);

// Multiple conditions
const adminOnly = conditional(
  (ctx) => {
    const auth = ctx.get('mcpkit:auth');
    return auth?.roles?.includes('admin');
  },
  async (ctx, next) => {
    // Admin-only logic
    await next();
  }
);
```

### withTimeout() - Timeout Wrapper

Add timeout to any middleware:

```typescript
import { withTimeout, TimeoutError } from '@mcpkit-dev/core';

// Timeout after 5 seconds
const timedMiddleware = withTimeout(
  async (ctx, next) => {
    await someSlowOperation();
    await next();
  },
  5000 // 5 seconds
);

// Handle timeout errors
try {
  await pipeline.execute(req, res);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Middleware timed out:', error.message);
  }
}
```

### withRetry() - Retry on Failure

Automatically retry failed middleware:

```typescript
import { withRetry } from '@mcpkit-dev/core';

const resilientMiddleware = withRetry(
  async (ctx, next) => {
    await unreliableExternalCall();
    await next();
  },
  {
    maxRetries: 3,
    delay: 1000,        // 1 second between retries
    backoff: 'exponential', // 1s, 2s, 4s
    retryOn: (error) => error.code === 'ECONNRESET',
  }
);
```

Options:

```typescript
interface RetryOptions {
  maxRetries: number;
  delay?: number;           // Base delay in ms
  backoff?: 'none' | 'linear' | 'exponential';
  retryOn?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}
```

### withErrorHandler() - Error Handling

Wrap middleware with error handling:

```typescript
import { withErrorHandler } from '@mcpkit-dev/core';

const safeMiddleware = withErrorHandler(
  async (ctx, next) => {
    await riskyOperation();
    await next();
  },
  {
    onError: (error, ctx) => {
      console.error('Middleware error:', error);
      // Optionally modify context or response
      ctx.set('error', error);
    },
    rethrow: false, // Swallow error and continue
  }
);
```

### withCache() - Response Caching

Cache middleware results:

```typescript
import { withCache } from '@mcpkit-dev/core';

const cachedMiddleware = withCache(
  async (ctx, next) => {
    // Expensive computation
    const data = await fetchExpensiveData();
    ctx.set('data', data);
    await next();
  },
  {
    key: (ctx) => `cache:${ctx.path}:${ctx.sessionId}`,
    ttl: 60000, // 1 minute
    store: new Map(), // Or use Redis, etc.
  }
);
```

### withHooks() - Add Lifecycle Hooks

Add before/after hooks to middleware:

```typescript
import { withHooks } from '@mcpkit-dev/core';

const hookedMiddleware = withHooks(
  async (ctx, next) => {
    await mainLogic();
    await next();
  },
  {
    before: (ctx) => {
      console.error('Before middleware');
      ctx.set('startTime', Date.now());
    },
    after: (ctx) => {
      const duration = Date.now() - ctx.get('startTime');
      console.error(`After middleware: ${duration}ms`);
    },
    onError: (error, ctx) => {
      console.error('Middleware failed:', error);
    },
    finally: (ctx) => {
      console.error('Cleanup');
    },
  }
);
```

## Middleware Composition

### compose() - Combine Middleware

Combine multiple middleware into one:

```typescript
import { compose } from '@mcpkit-dev/core';

const authAndLog = compose(
  loggingMiddleware,
  authMiddleware,
  rateLimitMiddleware
);

// Use as single middleware
@MCPServer({
  middleware: [authAndLog],
})
class MyServer {}
```

### createMiddlewareGroup() - Named Groups

Create reusable middleware groups:

```typescript
import { createMiddlewareGroup } from '@mcpkit-dev/core';

const securityGroup = createMiddlewareGroup('security', [
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  authMiddleware,
]);

const observabilityGroup = createMiddlewareGroup('observability', [
  tracingMiddleware,
  metricsMiddleware,
  loggingMiddleware,
]);

@MCPServer({
  middleware: [
    securityGroup,
    observabilityGroup,
  ],
})
class MyServer {}
```

### parallelMiddleware() - Run in Parallel

Execute independent middleware concurrently:

```typescript
import { parallelMiddleware } from '@mcpkit-dev/core';

// These run in parallel, not sequentially
const parallel = parallelMiddleware([
  async (ctx, next) => {
    ctx.set('userPrefs', await fetchUserPrefs());
    await next();
  },
  async (ctx, next) => {
    ctx.set('featureFlags', await fetchFeatureFlags());
    await next();
  },
  async (ctx, next) => {
    ctx.set('config', await fetchConfig());
    await next();
  },
]);

// All three fetches happen concurrently
```

### selectMiddleware() - Dynamic Selection

Choose middleware at runtime:

```typescript
import { selectMiddleware } from '@mcpkit-dev/core';

const dynamicAuth = selectMiddleware((ctx) => {
  const authHeader = ctx.request.headers['authorization'];

  if (authHeader?.startsWith('Bearer ')) {
    return jwtAuth({ secret: process.env.JWT_SECRET! });
  } else if (authHeader?.startsWith('ApiKey ')) {
    return apiKeyAuth({ keys: process.env.API_KEYS!.split(',') });
  } else {
    return async (ctx, next) => {
      ctx.response.writeHead(401);
      ctx.response.end('Unauthorized');
    };
  }
});
```

## Middleware Pipeline

### createPipeline() - Build Pipelines

Create a middleware pipeline with advanced features:

```typescript
import { createPipeline, MiddlewarePipeline } from '@mcpkit-dev/core';

const pipeline = createPipeline();

// Add middleware with priority (lower = runs first)
pipeline.use(loggingMiddleware, { priority: 0 });
pipeline.use(authMiddleware, { priority: 10 });
pipeline.use(rateLimitMiddleware, { priority: 20 });

// Add named middleware for removal/replacement
pipeline.use(cacheMiddleware, { name: 'cache' });

// Remove middleware by name
pipeline.remove('cache');

// Replace middleware
pipeline.replace('auth', newAuthMiddleware);

// Execute pipeline
await pipeline.execute(request, response, url, sessionId, handler);
```

### Pipeline Configuration

```typescript
const pipeline = createPipeline({
  // Error handler for all middleware
  onError: (error, ctx) => {
    console.error('Pipeline error:', error);
  },

  // Called before each middleware
  onBefore: (middlewareName, ctx) => {
    console.error(`Running: ${middlewareName}`);
  },

  // Called after each middleware
  onAfter: (middlewareName, ctx, duration) => {
    console.error(`${middlewareName} took ${duration}ms`);
  },
});
```

## Request Tracing Middleware

### tracing() - Basic Correlation IDs

Add correlation IDs for request tracking:

```typescript
import { tracing, getCorrelationId, CORRELATION_ID_KEY } from '@mcpkit-dev/core';

const tracingMiddleware = tracing({
  headerName: 'x-correlation-id',
  generateIfMissing: true,
  includeInResponse: true,
  log: true,
});

// In a tool handler
@Tool({ description: 'My tool' })
async myTool() {
  const correlationId = getCorrelationId(this.context);
  console.error(`[${correlationId}] Processing...`);
}
```

### advancedTracing() - Full Span Support

Advanced tracing with nested spans:

```typescript
import { advancedTracing, getTraceContext, TraceContext } from '@mcpkit-dev/core';

const tracingMiddleware = advancedTracing({
  headerName: 'x-trace-id',
  onSpanEnd: (span) => {
    // Send to tracing backend
    sendToJaeger(span);
  },
});

// In a tool handler
@Tool({ description: 'Complex operation' })
async complexOperation() {
  const traceCtx = getTraceContext(this.context);

  // Create child spans
  await traceCtx.trace('database.query', async () => {
    return await db.query('SELECT * FROM users');
  });

  await traceCtx.trace('external.api', async () => {
    return await fetch('https://api.example.com');
  });
}
```

## Authentication Middleware

### apiKeyAuth() - API Key Authentication

```typescript
import { apiKeyAuth } from '@mcpkit-dev/core';

const auth = apiKeyAuth({
  keys: ['key1', 'key2', 'key3'],
  header: 'x-api-key',        // or 'authorization'
  queryParam: 'api_key',      // fallback
  onUnauthorized: (ctx, reason) => {
    ctx.response.writeHead(401, { 'Content-Type': 'application/json' });
    ctx.response.end(JSON.stringify({ error: reason }));
  },
});
```

### jwtAuth() - JWT Authentication

```typescript
import { jwtAuth } from '@mcpkit-dev/core';

const auth = jwtAuth({
  secret: process.env.JWT_SECRET!,
  algorithms: ['HS256'],
  issuer: 'my-app',
  audience: 'my-api',
  clockTolerance: 60, // seconds
  skipPaths: ['/health', '/public/*'],
  getPrincipal: (payload, ctx) => ({
    userId: payload.sub,
    roles: payload.roles,
  }),
});
```

### bearerAuth() - Custom Token Validation

```typescript
import { bearerAuth } from '@mcpkit-dev/core';

const auth = bearerAuth({
  validate: async (token) => {
    const session = await sessionStore.get(token);
    if (!session) {
      return { valid: false, error: 'Invalid token' };
    }
    return {
      valid: true,
      principal: session.user,
      roles: session.roles,
    };
  },
});
```

## Rate Limiting Middleware

```typescript
import { rateLimit, MemoryRateLimitStore } from '@mcpkit-dev/core';

const limiter = rateLimit({
  windowMs: 60000,      // 1 minute
  maxRequests: 100,     // 100 requests per minute
  keyGenerator: (ctx) => ctx.request.headers['x-api-key'] || ctx.sessionId,
  store: new MemoryRateLimitStore(),
  onRateLimited: (ctx, retryAfter) => {
    ctx.response.writeHead(429, {
      'Retry-After': String(retryAfter),
      'Content-Type': 'application/json',
    });
    ctx.response.end(JSON.stringify({
      error: 'Too many requests',
      retryAfter,
    }));
  },
});
```

### Custom Rate Limit Store (Redis)

```typescript
import { RateLimitStore } from '@mcpkit-dev/core';
import Redis from 'ioredis';

class RedisRateLimitStore implements RateLimitStore {
  private redis = new Redis();

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const data = await this.redis.get(`ratelimit:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void> {
    await this.redis.setex(`ratelimit:${key}`, Math.ceil(ttl / 1000), JSON.stringify(value));
  }

  async increment(key: string): Promise<number> {
    return await this.redis.incr(`ratelimit:${key}`);
  }
}

const limiter = rateLimit({
  store: new RedisRateLimitStore(),
  // ...
});
```

## Complete Example

Combining multiple utilities:

```typescript
import {
  MCPServer,
  Tool,
  compose,
  conditional,
  withTimeout,
  withRetry,
  withErrorHandler,
  createMiddlewareGroup,
  tracing,
  jwtAuth,
  rateLimit,
} from '@mcpkit-dev/core';

// Security middleware group
const security = createMiddlewareGroup('security', [
  conditional(
    (ctx) => !ctx.path.startsWith('/public'),
    jwtAuth({ secret: process.env.JWT_SECRET! })
  ),
  rateLimit({
    windowMs: 60000,
    maxRequests: 100,
  }),
]);

// Observability middleware group
const observability = createMiddlewareGroup('observability', [
  tracing({ log: true }),
  withTimeout(
    async (ctx, next) => {
      const start = Date.now();
      await next();
      console.error(`Request took ${Date.now() - start}ms`);
    },
    30000
  ),
]);

// Resilience middleware
const resilience = withRetry(
  withErrorHandler(
    async (ctx, next) => {
      await next();
    },
    {
      onError: (error) => console.error('Request failed:', error),
      rethrow: true,
    }
  ),
  { maxRetries: 2, delay: 1000 }
);

@MCPServer({
  name: 'production-server',
  version: '1.0.0',
  middleware: [
    observability,
    security,
    resilience,
  ],
})
class ProductionServer {
  @Tool({ description: 'Process data' })
  async processData() {
    return { success: true };
  }
}
```

## Best Practices

1. **Order matters**: Put logging/tracing first, then auth, then rate limiting
2. **Use composition**: Group related middleware with `createMiddlewareGroup()`
3. **Handle errors**: Always use `withErrorHandler()` for critical middleware
4. **Set timeouts**: Prevent hanging requests with `withTimeout()`
5. **Use conditional**: Don't run auth on health check endpoints
6. **Name middleware**: Use names for easier debugging and management

## See Also

- [Middleware Basics](./middleware.md) - Creating custom middleware
- [Authentication](./authentication.md) - Auth middleware in depth
- [Rate Limiting](./rate-limiting.md) - Rate limiting patterns
- [Plugins Guide](./plugins-guide.md) - Packaging middleware as plugins
