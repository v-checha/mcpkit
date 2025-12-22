---
sidebar_position: 3
---

# Rate Limiting

Protect your server from abuse with configurable rate limiting.

:::caution Important: HTTP Transport Required

Rate limiting middleware **only works with HTTP transports** (`streamable-http`, `sse`). It does **not** work with `stdio` transport (the default), because stdio has no HTTP request/response cycle.

If you're using stdio (e.g., with Claude Desktop), see [Rate Limiting for Stdio](#rate-limiting-for-stdio) below.

:::

## HTTP Transport Rate Limiting

Use the `rateLimit` middleware with HTTP transports:

```typescript
import { createServer, MCPServer, Tool, Param, rateLimit, MemoryRateLimitStore } from '@mcpkit-dev/core';

@MCPServer({
  name: 'rate-limited-server',
  version: '1.0.0',
  middleware: [
    rateLimit({
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 100,    // 100 requests per window
      keyGenerator: (ctx) => ctx.get('auth')?.principal?.userId ?? 'anonymous',
      store: new MemoryRateLimitStore(),
      onRateLimited: (ctx) => {
        console.warn(`Rate limit exceeded for ${ctx.path}`);
      },
    }),
  ],
})
class RateLimitedServer {
  @Tool({ description: 'My tool' })
  async myTool(): Promise<string> {
    return 'done';
  }
}

const server = createServer(RateLimitedServer);

// Must use HTTP transport for middleware to work
server.listen({
  transport: 'streamable-http',
  port: 3000,
  path: '/mcp',
});
```

## Rate Limit Options

```typescript
rateLimit({
  // Time window in milliseconds
  windowMs: 60 * 1000,

  // Maximum requests per window
  maxRequests: 100,

  // Function to generate a unique key for each client
  keyGenerator: (ctx) => ctx.request.headers['x-api-key'] ?? 'anonymous',

  // Storage backend (in-memory by default)
  store: new MemoryRateLimitStore(),

  // Callback when rate limit is exceeded
  onRateLimited: (ctx) => {
    console.warn(`Rate limited: ${ctx.path}`);
  },

  // Skip rate limiting for certain requests
  skip: (ctx) => ctx.path === '/health',

  // Custom response headers
  headers: true,
})
```

## Rate Limiting for Stdio

For stdio transport (used by Claude Desktop), middleware doesn't run. Instead, use one of these approaches:

### Option 1: Using Server Hooks

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param, type ServerHooks } from '@mcpkit-dev/core';

// Simple in-memory rate limiter for stdio
class StdioRateLimiter {
  private calls: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing calls and filter to current window
    const calls = (this.calls.get(key) ?? []).filter((t) => t > windowStart);

    if (calls.length >= this.maxRequests) {
      const oldestCall = calls[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        resetIn: oldestCall + this.windowMs - now,
      };
    }

    // Record this call
    calls.push(now);
    this.calls.set(key, calls);

    return {
      allowed: true,
      remaining: this.maxRequests - calls.length,
      resetIn: this.windowMs,
    };
  }
}

// 5 requests per minute
const rateLimiter = new StdioRateLimiter(60 * 1000, 5);

const hooks: ServerHooks = {
  onToolCall: ({ toolName }) => {
    const result = rateLimiter.check(toolName);
    if (!result.allowed) {
      throw new Error(
        `Rate limit exceeded for "${toolName}". Try again in ${Math.ceil(result.resetIn / 1000)} seconds.`
      );
    }
    console.error(`[rate-limit] ${toolName}: ${result.remaining} calls remaining`);
  },
};

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks,
})
class MyServer {
  @Tool({ description: 'Add two numbers' })
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

const server = createServer(MyServer);
server.listen(); // stdio transport with rate limiting via hooks
```

### Option 2: Per-Tool Rate Limiting Decorator

Create a reusable decorator for tool-level rate limiting:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

// Rate limiter storage
const rateLimiters = new Map<string, { calls: number[]; windowMs: number; max: number }>();

function RateLimit(maxRequests: number, windowMs: number = 60000): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    const key = `${target.constructor.name}.${String(propertyKey)}`;

    rateLimiters.set(key, { calls: [], windowMs, max: maxRequests });

    descriptor.value = async function (...args: unknown[]) {
      const limiter = rateLimiters.get(key)!;
      const now = Date.now();
      const windowStart = now - limiter.windowMs;

      // Filter to current window
      limiter.calls = limiter.calls.filter((t) => t > windowStart);

      if (limiter.calls.length >= limiter.max) {
        const resetIn = Math.ceil((limiter.calls[0]! + limiter.windowMs - now) / 1000);
        throw new Error(`Rate limit exceeded. Try again in ${resetIn} seconds.`);
      }

      limiter.calls.push(now);
      return original.apply(this, args);
    };
  };
}

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add two numbers' })
  @RateLimit(2, 60000) // 2 calls per minute
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }

  @Tool({ description: 'Multiply two numbers' })
  @RateLimit(10, 60000) // 10 calls per minute (different limit)
  async multiply(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a * b;
  }
}

const server = createServer(MyServer);
server.listen();
```

### Option 3: Global Rate Limiting for All Tools

Apply a single rate limit across all tool calls:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param, type ServerHooks } from '@mcpkit-dev/core';

// Global rate limiter (all tools share the same limit)
const callTimes: number[] = [];
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;     // 10 total tool calls per minute

const hooks: ServerHooks = {
  onToolCall: ({ toolName }) => {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Remove old calls outside the window
    while (callTimes.length > 0 && callTimes[0]! < windowStart) {
      callTimes.shift();
    }

    if (callTimes.length >= MAX_REQUESTS) {
      const resetIn = Math.ceil((callTimes[0]! + WINDOW_MS - now) / 1000);
      throw new Error(`Global rate limit exceeded. Try again in ${resetIn} seconds.`);
    }

    callTimes.push(now);
    console.error(`[rate-limit] Global: ${MAX_REQUESTS - callTimes.length} calls remaining`);
  },
};

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks,
})
class MyServer {
  @Tool({ description: 'Tool A' })
  async toolA(): Promise<string> {
    return 'A';
  }

  @Tool({ description: 'Tool B' })
  async toolB(): Promise<string> {
    return 'B';
  }
}

const server = createServer(MyServer);
server.listen();
```

## Transport Compatibility Summary

| Transport | Rate Limiting Method |
|-----------|---------------------|
| `streamable-http` | `middleware: [rateLimit(...)]` |
| `sse` | `middleware: [rateLimit(...)]` |
| `stdio` (default) | Use hooks or custom `@RateLimit` decorator |

## Custom Rate Limit Store

For distributed deployments, implement a custom store (e.g., Redis):

```typescript
import { type RateLimitStore, type RateLimitInfo } from '@mcpkit-dev/core';

class RedisRateLimitStore implements RateLimitStore {
  constructor(private redis: RedisClient) {}

  async get(key: string): Promise<RateLimitInfo | undefined> {
    const data = await this.redis.get(`ratelimit:${key}`);
    return data ? JSON.parse(data) : undefined;
  }

  async set(key: string, info: RateLimitInfo, windowMs: number): Promise<void> {
    await this.redis.setex(
      `ratelimit:${key}`,
      Math.ceil(windowMs / 1000),
      JSON.stringify(info)
    );
  }

  async increment(key: string): Promise<number> {
    return await this.redis.incr(`ratelimit:${key}:count`);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`ratelimit:${key}`);
  }
}

// Usage
@MCPServer({
  name: 'distributed-server',
  version: '1.0.0',
  middleware: [
    rateLimit({
      windowMs: 60 * 1000,
      maxRequests: 100,
      store: new RedisRateLimitStore(redisClient),
    }),
  ],
})
class DistributedServer {}
```
