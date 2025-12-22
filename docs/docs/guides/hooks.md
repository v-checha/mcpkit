---
sidebar_position: 4
---

# Lifecycle Hooks

Hooks allow you to intercept and react to server events for logging, monitoring, and observability.

## Available Hooks

```typescript
import { MCPServer, type ServerHooks } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: {
    // Whether to await hook execution (default: true)
    awaitHooks: true,

    // Server lifecycle
    onServerStart: () => console.error('Server started'),
    onServerStop: () => console.error('Server stopped'),

    // Tool hooks
    onToolCall: ({ toolName, args, timestamp }) => {
      console.error(`[${timestamp}] Tool ${toolName} called`);
    },
    onToolSuccess: ({ toolName, duration, result }) => {
      console.error(`Tool ${toolName} completed in ${duration}ms`);
    },
    onToolError: ({ toolName, error, duration }) => {
      console.error(`Tool ${toolName} failed: ${error.message}`);
    },

    // Resource hooks
    onResourceRead: ({ uri }) => {
      console.error(`Reading resource: ${uri}`);
    },
    onResourceSuccess: ({ uri, duration }) => {
      console.error(`Resource read in ${duration}ms`);
    },
    onResourceError: ({ uri, error }) => {
      console.error(`Resource error: ${error.message}`);
    },

    // Prompt hooks
    onPromptGet: ({ promptName, args }) => {
      console.error(`Getting prompt: ${promptName}`);
    },
    onPromptSuccess: ({ promptName, duration }) => {
      console.error(`Prompt ready in ${duration}ms`);
    },
    onPromptError: ({ promptName, error }) => {
      console.error(`Prompt error: ${error.message}`);
    },
  },
})
class MyServer {}
```

## Hook Contexts

### Tool Context

```typescript
interface ToolCallContext {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

interface ToolSuccessContext {
  toolName: string;
  result: unknown;
  duration: number;
  timestamp: number;
}

interface ToolErrorContext {
  toolName: string;
  error: Error;
  duration: number;
  timestamp: number;
}
```

### Resource Context

```typescript
interface ResourceReadContext {
  uri: string;
  timestamp: number;
}

interface ResourceSuccessContext {
  uri: string;
  duration: number;
  timestamp: number;
}
```

## Combining with Observability

```typescript
import {
  createMetricsCollector,
  createTracer,
  consoleExporter,
} from '@mcpkit-dev/core';

const metrics = createMetricsCollector();
const tracer = createTracer({
  serviceName: 'my-server',
  exporters: [consoleExporter()],
});

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: {
    ...metrics.getHooks(),
    ...tracer.getHooks(),
  },
})
class MyServer {}
```
