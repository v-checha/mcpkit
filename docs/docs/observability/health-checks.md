---
sidebar_position: 2
---

# Health Checks

Kubernetes-compatible health check endpoints.

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, healthPlugin } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    healthPlugin({
      checks: [
        { name: 'database', critical: true, check: async () => ({ status: 'healthy' }) },
        { name: 'cache', critical: false, check: async () => ({ status: 'healthy' }) },
      ],
    }),
  ],
})
class MyServer {}

const server = createServer(MyServer);
await server.listen({
  transport: 'streamable-http',
  port: 3000,
});

// Endpoints:
// GET /health       - Aggregated status
// GET /health/live  - Liveness probe
// GET /health/ready - Readiness probe
```
