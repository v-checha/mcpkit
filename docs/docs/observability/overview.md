---
sidebar_position: 1
---

# Observability Overview

MCPKit provides comprehensive observability features for production MCP servers: **metrics**, **tracing**, and **health checks**. This guide explains how to use each feature and when to apply them.

## The Three Pillars

| Feature | Purpose | When to Use |
|---------|---------|-------------|
| **Metrics** | Count events, measure values | Dashboards, alerts, SLOs |
| **Tracing** | Track request flow | Debugging, performance analysis |
| **Health Checks** | Monitor system status | Load balancers, orchestrators |

## Quick Start

### Minimal Setup

```typescript
import {
  MCPServer,
  Tool,
  metricsPlugin,
  healthPlugin,
  tracingPlugin,
  createMetricsCollector,
  createHealthChecker,
  createTracer,
  consoleExporter,
} from '@mcpkit-dev/core';

// Create observability components
const metrics = createMetricsCollector({ prefix: 'myserver' });
const health = createHealthChecker();
const tracer = createTracer({
  serviceName: 'my-server',
  exporters: [consoleExporter()],
});

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    metricsPlugin({ collector: metrics }),
    healthPlugin({ checker: health }),
    tracingPlugin({ tracer }),
  ],
})
class MyServer {
  @Tool({ description: 'My tool' })
  async myTool() {
    return 'result';
  }
}
```

## Metrics

Metrics collect numerical data about your server's behavior over time.

### Creating a Metrics Collector

```typescript
import { createMetricsCollector } from '@mcpkit-dev/core';

const metrics = createMetricsCollector({
  // Prefix for all metric names
  prefix: 'myapp',

  // Default labels added to all metrics
  defaultLabels: {
    service: 'my-server',
    environment: 'production',
  },
});
```

### Metric Types

#### Counter - Count events

```typescript
// Create a counter
const requestCounter = metrics.counter({
  name: 'requests_total',
  help: 'Total number of requests',
  labels: ['method', 'status'],
});

// Increment
requestCounter.inc({ method: 'tool', status: 'success' });
requestCounter.inc({ method: 'tool', status: 'error' });

// Increment by value
requestCounter.inc({ method: 'resource', status: 'success' }, 5);
```

#### Gauge - Track current values

```typescript
// Create a gauge
const activeConnections = metrics.gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labels: ['transport'],
});

// Set value
activeConnections.set({ transport: 'stdio' }, 1);

// Increment/decrement
activeConnections.inc({ transport: 'http' });
activeConnections.dec({ transport: 'http' });
```

#### Histogram - Measure distributions

```typescript
// Create a histogram
const responseTimes = metrics.histogram({
  name: 'response_time_seconds',
  help: 'Response time in seconds',
  labels: ['tool'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5], // bucket boundaries
});

// Record observations
responseTimes.observe({ tool: 'search' }, 0.045);
responseTimes.observe({ tool: 'search' }, 0.123);

// Use timer helper
const timer = responseTimes.startTimer({ tool: 'process' });
await doWork();
timer.end(); // Records elapsed time
```

### Built-in Metrics

The `metricsPlugin` automatically tracks:

| Metric | Type | Description |
|--------|------|-------------|
| `mcp_tool_calls_total` | Counter | Total tool calls by name and status |
| `mcp_tool_duration_seconds` | Histogram | Tool execution time |
| `mcp_resource_reads_total` | Counter | Total resource reads |
| `mcp_prompt_gets_total` | Counter | Total prompt retrievals |
| `mcp_errors_total` | Counter | Total errors by type |

### Exposing Metrics

```typescript
import { metricsPlugin, createMetricsCollector } from '@mcpkit-dev/core';

const metrics = createMetricsCollector({ prefix: 'myapp' });

// Get Prometheus-format metrics
const prometheusMetrics = metrics.getMetrics();
console.log(prometheusMetrics);
// # HELP myapp_requests_total Total number of requests
// # TYPE myapp_requests_total counter
// myapp_requests_total{method="tool",status="success"} 42

// For HTTP transport, expose at /metrics endpoint
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    metricsPlugin({
      collector: metrics,
      endpoint: '/metrics', // Prometheus scrape endpoint
    }),
  ],
})
class MyServer {}
```

## Tracing

Tracing tracks the flow of requests through your system.

### Setting Up Tracing

```typescript
import { createTracer, setGlobalTracer, consoleExporter } from '@mcpkit-dev/core';

// Development: console output
const tracer = createTracer({
  serviceName: 'my-server',
  serviceVersion: '1.0.0',
  exporters: [consoleExporter()],
});

// Production: OTLP exporter (Jaeger, Zipkin, etc.)
const prodTracer = createTracer({
  serviceName: 'my-server',
  serviceVersion: '1.0.0',
  environment: 'production',
  exporters: [
    {
      type: 'otlp',
      endpoint: 'http://jaeger:4318/v1/traces',
    },
  ],
  sampler: { ratio: 0.1 }, // Sample 10% of requests
});

// Set as global tracer for @Traced decorator
setGlobalTracer(tracer);
```

### Using @Traced Decorator

```typescript
import { Traced } from '@mcpkit-dev/core';

@Tool({ description: 'Process order' })
@Traced({
  name: 'order.process',
  attributes: { 'order.type': 'standard' },
  extractAttributes: (orderId) => ({ 'order.id': orderId }),
})
async processOrder(@Param({ name: 'orderId' }) orderId: string) {
  return { status: 'completed' };
}
```

### Manual Spans

```typescript
import { withTrace, getGlobalTracer } from '@mcpkit-dev/core';

const tracer = getGlobalTracer();

async function complexOperation() {
  // Create a span for a code section
  return await withTrace(tracer, 'database.query', async (span) => {
    span.setAttribute('db.system', 'postgresql');

    const result = await db.query('SELECT * FROM users');

    span.setAttribute('db.rows', result.length);
    return result;
  });
}
```

### Tracing Plugin

Automatically trace all MCP operations:

```typescript
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    tracingPlugin({
      tracer,
      traceTools: true,
      traceResources: true,
      tracePrompts: true,
    }),
  ],
})
class MyServer {}
```

## Health Checks

Health checks report system status for load balancers and orchestrators.

### Creating Health Checks

```typescript
import { createHealthChecker } from '@mcpkit-dev/core';

const health = createHealthChecker();

// Add checks
health.addCheck('database', async () => {
  const connected = await db.ping();
  return {
    status: connected ? 'healthy' : 'unhealthy',
    message: connected ? 'Connected' : 'Connection failed',
  };
});

health.addCheck('redis', async () => {
  try {
    await redis.ping();
    return { status: 'healthy' };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}, { critical: true }); // Mark as critical

health.addCheck('external-api', async () => {
  const response = await fetch('https://api.example.com/health');
  return {
    status: response.ok ? 'healthy' : 'degraded',
    details: { responseTime: response.headers.get('x-response-time') },
  };
}, { critical: false }); // Non-critical
```

### Check Status Values

| Status | Meaning | HTTP Code |
|--------|---------|-----------|
| `healthy` | All systems operational | 200 |
| `degraded` | Some issues, but functional | 200 |
| `unhealthy` | System not functioning | 503 |

### Running Health Checks

```typescript
// Run all checks
const result = await health.check();
console.log(result);
// {
//   status: 'healthy',
//   checks: {
//     database: { status: 'healthy', message: 'Connected' },
//     redis: { status: 'healthy' },
//     'external-api': { status: 'healthy', details: { responseTime: '45ms' } }
//   }
// }

// Run specific check
const dbHealth = await health.checkOne('database');
```

### Kubernetes Probes

```typescript
import { healthPlugin, createHealthChecker, createHealthHandler } from '@mcpkit-dev/core';

const health = createHealthChecker();

// Liveness: Is the process alive?
health.addCheck('process', async () => ({ status: 'healthy' }));

// Readiness: Can it handle traffic?
health.addCheck('database', async () => {
  const ready = await db.isReady();
  return { status: ready ? 'healthy' : 'unhealthy' };
}, { critical: true });

// For HTTP transport
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    healthPlugin({
      checker: health,
      livePath: '/health/live',   // Liveness probe
      readyPath: '/health/ready', // Readiness probe
    }),
  ],
})
class MyServer {}

// Kubernetes config:
// livenessProbe:
//   httpGet:
//     path: /health/live
//     port: 3000
// readinessProbe:
//   httpGet:
//     path: /health/ready
//     port: 3000
```

## Combining All Three

A production server with full observability:

```typescript
import {
  MCPServer,
  Tool,
  Traced,
  Monitor,
  createMetricsCollector,
  createHealthChecker,
  createTracer,
  metricsPlugin,
  healthPlugin,
  tracingPlugin,
  setGlobalTracer,
} from '@mcpkit-dev/core';

// Initialize observability
const metrics = createMetricsCollector({ prefix: 'orderservice' });
const health = createHealthChecker();
const tracer = createTracer({
  serviceName: 'order-service',
  serviceVersion: '1.0.0',
  exporters: [{ type: 'otlp', endpoint: process.env.OTLP_ENDPOINT! }],
});

setGlobalTracer(tracer);

// Custom metrics
const orderCounter = metrics.counter({
  name: 'orders_total',
  help: 'Total orders processed',
  labels: ['status'],
});

// Health checks
health.addCheck('database', async () => {
  const ok = await db.ping();
  return { status: ok ? 'healthy' : 'unhealthy' };
}, { critical: true });

health.addCheck('payment-gateway', async () => {
  const ok = await paymentGateway.healthCheck();
  return { status: ok ? 'healthy' : 'degraded' };
});

@MCPServer({
  name: 'order-service',
  version: '1.0.0',
  plugins: [
    metricsPlugin({ collector: metrics, endpoint: '/metrics' }),
    healthPlugin({ checker: health, livePath: '/health/live', readyPath: '/health/ready' }),
    tracingPlugin({ tracer, traceTools: true }),
  ],
})
class OrderService {
  @Tool({ description: 'Create a new order' })
  @Traced({ name: 'order.create' })
  @Monitor({ logDuration: true, logErrors: true })
  async createOrder(
    @Param({ name: 'customerId' }) customerId: string,
    @Param({ name: 'items' }) items: string[]
  ) {
    try {
      const order = await db.createOrder({ customerId, items });
      orderCounter.inc({ status: 'success' });
      return order;
    } catch (error) {
      orderCounter.inc({ status: 'error' });
      throw error;
    }
  }
}
```

## Best Practices

### Metrics
- Use consistent naming: `noun_verb_unit` (e.g., `http_requests_total`)
- Include relevant labels but avoid high cardinality
- Set appropriate histogram buckets for your latency profile

### Tracing
- Trace at service boundaries, not every function
- Include relevant attributes for debugging
- Use sampling in production to reduce overhead

### Health Checks
- Keep checks fast (< 1 second)
- Mark truly critical dependencies as `critical: true`
- Use separate liveness and readiness probes

## See Also

- [Metrics Reference](./metrics.md) - Detailed metrics API
- [Tracing Reference](./tracing.md) - Advanced tracing configuration
- [Health Checks Reference](./health-checks.md) - Health check patterns
- [Debugging Guide](../guides/debugging.md) - @Debug and @Monitor decorators
- [@Traced Decorator](../guides/tracing-decorator.md) - Tracing decorator guide
