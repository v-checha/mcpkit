---
sidebar_position: 1
---

# Metrics

Prometheus-compatible metrics for monitoring.

```typescript
import { createMetricsCollector, metricsPlugin } from '@mcpkit-dev/core';

// Using plugin
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [metricsPlugin({ prefix: 'myapp_' })],
})
class MyServer {}

// Manual usage
const metrics = createMetricsCollector({ prefix: 'myapp_' });

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: metrics.getHooks(),
})
class MyServer {}

// Expose endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.export());
});
```

## Built-in Metrics

- `mcpkit_tool_calls_total` - Total tool invocations
- `mcpkit_tool_duration_seconds` - Tool execution time histogram
- `mcpkit_tool_errors_total` - Tool error counts
- `mcpkit_active_connections` - Current active connections
