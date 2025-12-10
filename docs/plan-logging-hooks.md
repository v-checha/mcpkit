# Logging/Monitoring Hooks Implementation Plan

## Overview

Add comprehensive logging and monitoring capabilities to MCPKit through lifecycle hooks and a `@Monitor` decorator.

## Features

### 1. Server Lifecycle Hooks

Hooks defined in `@MCPServer` options that fire on key events:

```typescript
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: {
    // Server lifecycle
    onServerStart: () => void,
    onServerStop: () => void,

    // Tool events
    onToolCall: (context: ToolCallContext) => void | Promise<void>,
    onToolSuccess: (context: ToolSuccessContext) => void | Promise<void>,
    onToolError: (context: ToolErrorContext) => void | Promise<void>,

    // Resource events
    onResourceRead: (context: ResourceReadContext) => void | Promise<void>,

    // Prompt events
    onPromptGet: (context: PromptGetContext) => void | Promise<void>,
  }
})
```

### 2. Context Types

```typescript
interface ToolCallContext {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

interface ToolSuccessContext extends ToolCallContext {
  result: unknown;
  duration: number; // milliseconds
}

interface ToolErrorContext extends ToolCallContext {
  error: Error;
  duration: number;
}

interface ResourceReadContext {
  uri: string;
  timestamp: number;
  duration?: number;
  error?: Error;
}

interface PromptGetContext {
  promptName: string;
  args?: Record<string, string>;
  timestamp: number;
  duration?: number;
  error?: Error;
}
```

### 3. @Monitor Decorator (Optional Per-Tool)

For fine-grained control over individual tools:

```typescript
@Tool({ description: 'Important operation' })
@Monitor({
  logArgs: true,      // Log input arguments
  logResult: true,    // Log return value
  logDuration: true,  // Log execution time
  logErrors: true,    // Log errors
  logger: customLogger, // Custom logger function
})
async importantTool(@Param({ name: 'data' }) data: string) {
  return `Processed: ${data}`;
}
```

## Implementation Steps

### Step 1: Define Types

File: `packages/core/src/types/hooks.ts`

- Define all hook context interfaces
- Define ServerHooks interface
- Define MonitorOptions interface

### Step 2: Update MCPServer Decorator Options

File: `packages/core/src/decorators/server.ts`

- Add `hooks` property to MCPServerDecoratorOptions
- Store hooks in metadata

### Step 3: Create Monitor Decorator

File: `packages/core/src/decorators/monitor.ts`

- Create @Monitor decorator
- Store monitor options in metadata per method

### Step 4: Update Bootstrap

File: `packages/core/src/server/bootstrap.ts`

- Wrap tool handlers with hook invocations
- Wrap resource handlers with hook invocations
- Wrap prompt handlers with hook invocations
- Call server lifecycle hooks

### Step 5: Update Exports

File: `packages/core/src/index.ts`

- Export new types and decorators

### Step 6: Add Tests

File: `packages/core/src/hooks/hooks.test.ts`

- Test lifecycle hooks are called
- Test timing is recorded
- Test error hooks are called on failure
- Test @Monitor decorator

### Step 7: Update Documentation

- Update README with hooks examples
- Add hooks to API reference

## File Changes Summary

| File | Action |
|------|--------|
| `src/types/hooks.ts` | Create |
| `src/types/index.ts` | Update exports |
| `src/decorators/server.ts` | Add hooks option |
| `src/decorators/monitor.ts` | Create |
| `src/decorators/index.ts` | Update exports |
| `src/metadata/storage.ts` | Add monitor metadata |
| `src/metadata/types.ts` | Add monitor types |
| `src/server/bootstrap.ts` | Implement hook invocations |
| `src/index.ts` | Update exports |
| `src/hooks/hooks.test.ts` | Create tests |

## Usage Examples

### Basic Logging

```typescript
@MCPServer({
  name: 'logged-server',
  version: '1.0.0',
  hooks: {
    onToolCall: ({ toolName, args }) => {
      console.log(`[${new Date().toISOString()}] Tool called: ${toolName}`, args);
    },
    onToolSuccess: ({ toolName, duration }) => {
      console.log(`[${new Date().toISOString()}] Tool ${toolName} completed in ${duration}ms`);
    },
    onToolError: ({ toolName, error, duration }) => {
      console.error(`[${new Date().toISOString()}] Tool ${toolName} failed after ${duration}ms:`, error.message);
    },
  }
})
class LoggedServer { ... }
```

### Metrics Collection

```typescript
import { metrics } from './metrics';

@MCPServer({
  name: 'monitored-server',
  version: '1.0.0',
  hooks: {
    onToolSuccess: ({ toolName, duration }) => {
      metrics.histogram('tool_duration_ms', duration, { tool: toolName });
      metrics.counter('tool_calls_total', 1, { tool: toolName, status: 'success' });
    },
    onToolError: ({ toolName }) => {
      metrics.counter('tool_calls_total', 1, { tool: toolName, status: 'error' });
    },
  }
})
class MetricsServer { ... }
```

### Per-Tool Monitoring

```typescript
@MCPServer({ name: 'server', version: '1.0.0' })
class Server {
  // Only monitor this specific tool
  @Tool({ description: 'Sensitive operation' })
  @Monitor({ logArgs: true, logResult: false, logDuration: true })
  async sensitiveOp(@Param({ name: 'secret' }) secret: string) {
    return 'done';
  }

  // No monitoring on this tool
  @Tool({ description: 'Fast operation' })
  async fastOp() {
    return 'quick';
  }
}
```
