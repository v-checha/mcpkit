---
sidebar_position: 1
---

# Middleware

Middleware allows you to intercept and process HTTP requests before they reach your tools.

:::caution HTTP Transport Only

Middleware **only works with HTTP transports** (`streamable-http`, `sse`). It does **not** work with `stdio` transport (the default).

For stdio transport (used by Claude Desktop), use [server hooks](/docs/guides/hooks) instead.

:::

## Creating Middleware

```typescript
import { Middleware, MiddlewareContext, NextFunction } from '@mcpkit-dev/core';

const loggingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.method} ${ctx.path}`);

  await next();

  console.log(`← ${ctx.method} ${ctx.path} (${Date.now() - start}ms)`);
};
```

## Using Middleware

```typescript
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  middleware: [loggingMiddleware, authMiddleware],
})
class MyServer {}
```

## Middleware Context

```typescript
interface MiddlewareContext {
  request: IncomingMessage;
  response: ServerResponse;
  sessionId?: string;
  url: URL;
  method: string;
  path: string;
  body?: unknown;
  state: Map<string, unknown>;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}
```

## Named Middleware

```typescript
import { NamedMiddleware } from '@mcpkit-dev/core';

const corsMiddleware: NamedMiddleware = {
  name: 'cors',
  handler: async (ctx, next) => {
    ctx.response.setHeader('Access-Control-Allow-Origin', '*');
    await next();
  },
  options: {
    paths: ['/api/*'],
    order: 1,
  },
};
```

## Middleware Chain Enhancements

```typescript
import {
  conditional,
  withTimeout,
  withRetry,
  withErrorHandler,
} from '@mcpkit-dev/core';

// Conditional execution
const adminOnly = conditional(authMiddleware, {
  when: (ctx) => ctx.path.startsWith('/admin'),
});

// With timeout
const withTimeoutMiddleware = withTimeout(slowMiddleware, {
  ms: 5000,
  onTimeout: () => console.log('Timed out'),
});

// With retry
const withRetryMiddleware = withRetry(unreliableMiddleware, {
  attempts: 3,
  delay: 1000,
});

// With error handling
const safeMiddleware = withErrorHandler(riskyMiddleware, {
  onError: (error, ctx) => {
    console.error('Middleware error:', error);
    ctx.response.statusCode = 500;
  },
});
```
