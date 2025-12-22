---
sidebar_position: 7
---

# Distributed Tracing with @Traced

The `@Traced` decorator adds OpenTelemetry-compatible distributed tracing to your MCP server methods. This enables you to track request flow, measure performance, and debug issues across your application.

## Quick Start

```typescript
import { MCPServer, Tool, Param, Traced, setGlobalTracer, createTracer, consoleExporter } from '@mcpkit-dev/core';

// Setup tracer (do this once at startup)
const tracer = createTracer({
  serviceName: 'my-mcp-server',
  exporters: [consoleExporter()],
});
setGlobalTracer(tracer);

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Process data' })
  @Traced()  // Automatically creates spans for this method
  async processData(@Param({ name: 'input' }) input: string) {
    return { processed: input.toUpperCase() };
  }
}
```

**Console Output:**
```
{
  "name": "tool:processData",
  "kind": "internal",
  "status": "ok",
  "duration": 5,
  "attributes": {
    "mcp.tool.name": "processData",
    "mcp.tool.args.input": "hello"
  }
}
```

## Setting Up the Tracer

Before using `@Traced`, you must configure a global tracer:

### Basic Console Tracer

```typescript
import { createTracer, setGlobalTracer, consoleExporter } from '@mcpkit-dev/core';

const tracer = createTracer({
  serviceName: 'my-server',
  serviceVersion: '1.0.0',
  exporters: [consoleExporter()],
});

setGlobalTracer(tracer);
```

### Production Tracer (OTLP/Jaeger)

```typescript
import { createTracer, setGlobalTracer } from '@mcpkit-dev/core';

const tracer = createTracer({
  serviceName: 'my-server',
  serviceVersion: '1.0.0',
  environment: 'production',
  exporters: [
    {
      type: 'otlp',
      endpoint: 'http://jaeger:4318/v1/traces',
      headers: { 'Authorization': 'Bearer token' },
    },
  ],
});

setGlobalTracer(tracer);
```

### Testing with Memory Exporter

```typescript
import { createTracer, setGlobalTracer, memoryExporter } from '@mcpkit-dev/core';

const exporter = memoryExporter();
const tracer = createTracer({
  serviceName: 'test-server',
  exporters: [exporter],
});

setGlobalTracer(tracer);

// After running code...
const spans = exporter.getSpans();
console.log('Captured spans:', spans.length);

// Clear spans between tests
exporter.clear();
```

## @Traced Options

```typescript
interface TracedOptions {
  // Custom span name (default: "type:methodName")
  name?: string;

  // Span kind: 'internal', 'server', 'client' (default: 'internal')
  kind?: 'internal' | 'server' | 'client';

  // Static attributes to add to span
  attributes?: SpanAttributes;

  // Extract attributes from method arguments
  extractAttributes?: (...args: unknown[]) => SpanAttributes;

  // Record result in span attributes (default: false)
  recordResult?: boolean;

  // Max size for result in attributes (default: 1000 chars)
  maxResultSize?: number;
}
```

### Custom Span Name

```typescript
@Tool({ description: 'Send notification' })
@Traced({ name: 'notifications.send' })
async sendNotification(@Param({ name: 'userId' }) userId: string) {
  // Span will be named "notifications.send" instead of "tool:sendNotification"
}
```

### Adding Attributes

Static attributes:

```typescript
@Tool({ description: 'Process payment' })
@Traced({
  attributes: {
    'payment.provider': 'stripe',
    'payment.currency': 'USD',
  },
})
async processPayment(@Param({ name: 'amount' }) amount: number) {
  // ...
}
```

Dynamic attributes from arguments:

```typescript
@Tool({ description: 'Fetch user' })
@Traced({
  extractAttributes: (userId: string, options?: { includeOrders: boolean }) => ({
    'user.id': userId,
    'fetch.includeOrders': options?.includeOrders ?? false,
  }),
})
async fetchUser(
  @Param({ name: 'userId' }) userId: string,
  @Param({ name: 'options', optional: true }) options?: { includeOrders: boolean }
) {
  // ...
}
```

### Recording Results

```typescript
@Tool({ description: 'Search products' })
@Traced({
  recordResult: true,
  maxResultSize: 500, // Truncate results longer than 500 chars
})
async searchProducts(@Param({ name: 'query' }) query: string) {
  const products = await db.search(query);
  return products; // Result will be in span attributes
}
```

### Span Kinds

```typescript
// Internal processing (default)
@Traced({ kind: 'internal' })

// Handling incoming request
@Traced({ kind: 'server' })

// Making outbound call
@Traced({ kind: 'client' })
```

## Manual Tracing Functions

For more control, use the `traced()` and `withTrace()` functions:

### traced() - Wrap Any Function

```typescript
import { traced, getGlobalTracer } from '@mcpkit-dev/core';

const tracer = getGlobalTracer();

// Wrap an async function
const fetchWithTrace = traced(
  tracer,
  'http.fetch',
  async (url: string) => {
    const response = await fetch(url);
    return response.json();
  },
  {
    kind: 'client',
    extractAttributes: (url) => ({ 'http.url': url }),
  }
);

// Use it
const data = await fetchWithTrace('https://api.example.com/data');
```

### withTrace() - Create Spans Manually

```typescript
import { withTrace, getGlobalTracer } from '@mcpkit-dev/core';

const tracer = getGlobalTracer();

async function complexOperation() {
  // Create a span for a specific section
  const result = await withTrace(
    tracer,
    'database.query',
    async (span) => {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.statement', 'SELECT * FROM users');

      const users = await db.query('SELECT * FROM users');

      span.setAttribute('db.rows_returned', users.length);
      return users;
    },
    { kind: 'client' }
  );

  return result;
}
```

### Nested Spans

Spans automatically nest to show call hierarchy:

```typescript
@Tool({ description: 'Process order' })
@Traced({ name: 'order.process' })
async processOrder(@Param({ name: 'orderId' }) orderId: string) {
  // Child span for validation
  await withTrace(tracer, 'order.validate', async () => {
    await this.validateOrder(orderId);
  });

  // Child span for payment
  await withTrace(tracer, 'order.payment', async (span) => {
    span.setAttribute('payment.method', 'credit_card');
    await this.chargePayment(orderId);
  });

  // Child span for fulfillment
  await withTrace(tracer, 'order.fulfill', async () => {
    await this.fulfillOrder(orderId);
  });

  return { status: 'completed' };
}
```

**Trace Hierarchy:**
```
order.process (15ms)
├── order.validate (2ms)
├── order.payment (8ms)
│   └── payment.method: credit_card
└── order.fulfill (5ms)
```

## Using with Tracing Plugin

For automatic tracing of all tools, resources, and prompts:

```typescript
import { MCPServer, tracingPlugin, createTracer, consoleExporter } from '@mcpkit-dev/core';

const tracer = createTracer({
  serviceName: 'my-server',
  exporters: [consoleExporter()],
});

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    tracingPlugin({
      tracer,
      // Automatically trace all tools
      traceTools: true,
      // Automatically trace all resources
      traceResources: true,
      // Automatically trace all prompts
      tracePrompts: true,
      // Add request attributes
      extractRequestAttributes: (ctx) => ({
        'request.path': ctx.path,
        'session.id': ctx.sessionId,
      }),
    }),
  ],
})
class MyServer {
  // All methods are automatically traced!
  @Tool({ description: 'My tool' })
  async myTool() {
    return 'result';
  }
}
```

## Tracer Configuration Reference

```typescript
interface TracerOptions {
  // Service identification
  serviceName: string;
  serviceVersion?: string;
  environment?: string;

  // Span exporters
  exporters: TracerExporter[];

  // Sampling (default: always sample)
  sampler?: 'always' | 'never' | { ratio: number };

  // Resource attributes
  resourceAttributes?: Record<string, string>;
}

// Exporter types
type TracerExporter =
  | { type: 'console' }
  | { type: 'memory' }
  | {
      type: 'otlp';
      endpoint: string;
      headers?: Record<string, string>;
    };

// Helper functions
const consoleExporter = () => ({ type: 'console' });
const memoryExporter = () => ({ type: 'memory', getSpans: () => [...], clear: () => void });
```

## Span Attributes Convention

MCPKit follows OpenTelemetry semantic conventions:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `mcp.tool.name` | Tool name | `"fetchUser"` |
| `mcp.resource.uri` | Resource URI | `"file:///data.json"` |
| `mcp.prompt.name` | Prompt name | `"greeting"` |
| `mcp.session.id` | Session ID | `"abc-123"` |
| `error.type` | Error class name | `"ValidationError"` |
| `error.message` | Error message | `"Invalid input"` |

## Error Handling

Errors are automatically captured in spans:

```typescript
@Tool({ description: 'Risky operation' })
@Traced()
async riskyOperation() {
  throw new Error('Something went wrong');
}

// Span will have:
// - status: "error"
// - error.type: "Error"
// - error.message: "Something went wrong"
// - error.stack: "Error: Something went wrong\n    at..."
```

## Best Practices

1. **Set up tracer at application startup**, before any traced code runs
2. **Use meaningful span names** that describe the operation
3. **Add relevant attributes** for debugging (user ID, request ID, etc.)
4. **Use appropriate span kinds**: server for handlers, client for outbound calls
5. **Don't over-trace**: Focus on important operations, not every function
6. **Use sampling in production** to reduce overhead: `sampler: { ratio: 0.1 }`
7. **Include service version** for tracking deployments

## See Also

- [Observability Overview](../observability/overview.md) - Complete observability guide
- [Tracing Configuration](../observability/tracing.md) - Advanced tracing setup
- [Debugging Guide](./debugging.md) - @Debug and @Monitor decorators
