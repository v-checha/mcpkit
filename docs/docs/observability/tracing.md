---
sidebar_position: 3
---

# Distributed Tracing

OpenTelemetry-compatible tracing for your MCP server.

```typescript
import 'reflect-metadata';
import {
  createServer,
  MCPServer,
  Tool,
  Param,
  Traced,
  createTracer,
  consoleExporter,
  tracingPlugin,
  setGlobalTracer,
} from '@mcpkit-dev/core';

// Setup global tracer
const tracer = createTracer({
  serviceName: 'my-server',
  exporters: [consoleExporter()],
});
setGlobalTracer(tracer);

// Using plugin
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [tracingPlugin({ serviceName: 'my-server', exporters: [consoleExporter()] })],
})
class MyServer {
  // Using @Traced decorator
  @Tool({ description: 'Fetch data' })
  @Traced({ name: 'data.fetch', kind: 'client', attributes: { 'db.system': 'postgresql' } })
  async fetchData(@Param({ name: 'id' }) id: string) {
    return await db.find(id);
  }
}

const server = createServer(MyServer);
await server.listen();

// Manual spans
await tracer.withSpan('my-operation', async (span) => {
  span.setAttribute('custom.attr', 'value');
  return await doWork();
});
```
