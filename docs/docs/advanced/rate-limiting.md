---
sidebar_position: 3
---

# Rate Limiting

Protect your server from abuse with configurable rate limiting.

```typescript
import { rateLimit, MemoryRateLimitStore } from '@mcpkit-dev/core';

@MCPServer({
  name: 'rate-limited-server',
  version: '1.0.0',
  middleware: [
    rateLimit({
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 100,    // 100 requests per window
      keyGenerator: (ctx) => ctx.get('auth')?.principal?.userId ?? 'anonymous',
      store: new MemoryRateLimitStore(),
      onRateLimit: (ctx) => {
        console.warn(`Rate limit exceeded for ${ctx.path}`);
      },
    }),
  ],
})
class RateLimitedServer {}
```
