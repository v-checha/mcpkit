---
sidebar_position: 6
---

# Gateway

Proxy and load balance across upstream MCP servers.

```typescript
import { createGateway } from '@mcpkit-dev/core';

const gateway = createGateway({
  name: 'api-gateway',
  version: '1.0.0',
  upstreams: [
    { url: 'http://weather-server:3000', toolPrefix: 'weather_', healthCheck: true },
    { url: 'http://news-server:3000', toolPrefix: 'news_', healthCheck: true },
  ],
  loadBalancing: 'round-robin', // 'random' | 'weighted' | 'least-connections'
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
  },
  onUpstreamUnhealthy: (upstream, error) => {
    console.error(`Upstream ${upstream.url} is down:`, error.message);
  },
});

await gateway.start();
```
