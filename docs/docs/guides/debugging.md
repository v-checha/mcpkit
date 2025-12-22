---
sidebar_position: 6
---

# Debugging & Monitoring

MCPKit provides two decorators for observability: `@Debug` for development-time logging and `@Monitor` for production monitoring. Understanding when and how to use each is essential for building maintainable MCP servers.

## Quick Comparison

| Feature | @Debug | @Monitor |
|---------|--------|----------|
| **Purpose** | Development debugging | Production monitoring |
| **Default state** | Disabled (unless NODE_ENV=development) | Always active when applied |
| **Output** | Detailed logs with timing | Integrates with hooks system |
| **Sanitization** | Built-in sensitive data filtering | Manual via logger |
| **Performance** | Higher overhead | Lower overhead |

## @Debug Decorator

The `@Debug` decorator adds comprehensive logging for method calls, including arguments, results, timing, and errors.

### Basic Usage

```typescript
import { MCPServer, Tool, Param, Debug } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Process user data' })
  @Debug({ enabled: true })
  async processData(
    @Param({ name: 'userId' }) userId: string,
    @Param({ name: 'action' }) action: string
  ) {
    // Your logic here
    return { success: true };
  }
}
```

**Output** (to stderr):
```
[2024-01-15T10:30:00.000Z] [DEBUG] → tool:processData {
  "type": "tool",
  "name": "processData",
  "args": ["user-123", "update"]
}
[2024-01-15T10:30:00.050Z] [DEBUG] ← tool:processData ✓ {
  "type": "tool",
  "name": "processData",
  "duration": "50ms",
  "result": { "success": true }
}
```

### Debug Options

```typescript
interface DebugOptions {
  // Enable/disable debug logging (default: based on NODE_ENV)
  enabled?: boolean;

  // Minimum log level (default: 'debug')
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';

  // Log input arguments (default: true)
  logArgs?: boolean;

  // Log return value (default: true)
  logResult?: boolean;

  // Log execution duration (default: true)
  logDuration?: boolean;

  // Custom logger implementation
  logger?: DebugLogger;

  // Sanitize sensitive data
  sanitize?: (key: string, value: unknown) => unknown;

  // Custom label for log output
  label?: string;
}
```

### Global Debug Configuration

Configure debug settings globally for all `@Debug` decorators:

```typescript
import { configureDebug, getDebugConfig } from '@mcpkit-dev/core';

// Enable debug globally
configureDebug({
  enabled: true,
  level: 'debug',
  logArgs: true,
  logResult: true,
  logDuration: true,
});

// Check current config
const config = getDebugConfig();
console.error('Debug enabled:', config.enabled);
```

### Environment-Based Activation

By default, `@Debug` is automatically enabled when:
- `NODE_ENV === 'development'`
- `MCPKIT_DEBUG === 'true'`

```bash
# Enable debug mode via environment
NODE_ENV=development node dist/index.js

# Or explicitly
MCPKIT_DEBUG=true node dist/index.js
```

### Sanitizing Sensitive Data

Prevent sensitive data from appearing in logs:

```typescript
@Tool({ description: 'User login' })
@Debug({
  enabled: true,
  sanitize: (key, value) => {
    // Redact passwords and tokens
    if (key.toLowerCase().includes('password')) return '[REDACTED]';
    if (key.toLowerCase().includes('token')) return '[REDACTED]';
    if (key.toLowerCase().includes('secret')) return '[REDACTED]';
    return value;
  },
})
async login(
  @Param({ name: 'username' }) username: string,
  @Param({ name: 'password' }) password: string
) {
  // password will appear as [REDACTED] in logs
}
```

**Built-in Sanitization**: By default, fields containing `password`, `token`, `secret`, `apiKey`, or `authorization` are automatically redacted.

### Custom Debug Logger

Implement your own logger for integration with logging systems:

```typescript
import { Debug, DebugLogger, DebugLevel } from '@mcpkit-dev/core';

const customLogger: DebugLogger = {
  log(level: DebugLevel, message: string, data?: Record<string, unknown>) {
    // Send to your logging service (always use stderr for stdio transport!)
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    }));
  },
};

@Tool({ description: 'Process order' })
@Debug({ enabled: true, logger: customLogger })
async processOrder(@Param({ name: 'orderId' }) orderId: string) {
  // ...
}
```

### Log Levels

Control what gets logged with the `level` option:

```typescript
// Only log warnings and errors
@Debug({ enabled: true, level: 'warn' })

// Log everything including trace
@Debug({ enabled: true, level: 'trace' })
```

Level hierarchy: `trace` < `debug` < `info` < `warn` < `error`

## @Monitor Decorator

The `@Monitor` decorator integrates with MCPKit's hooks system for production-grade monitoring.

### Basic Usage

```typescript
import { MCPServer, Tool, Param, Monitor } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Fetch data' })
  @Monitor({ logDuration: true, logErrors: true })
  async fetchData(@Param({ name: 'id' }) id: string) {
    return { data: 'result' };
  }
}
```

### Monitor Options

```typescript
interface MonitorOptions {
  // Log input arguments (default: false)
  logArgs?: boolean;

  // Log return value (default: false)
  logResult?: boolean;

  // Log execution duration (default: true)
  logDuration?: boolean;

  // Log errors (default: true)
  logErrors?: boolean;

  // Custom logger function (default: console.error)
  logger?: (message: string, data: Record<string, unknown>) => void;

  // Separate error logger (default: console.error)
  errorLogger?: (message: string, data: Record<string, unknown>) => void;
}
```

### Integration with Hooks

`@Monitor` works alongside server hooks. The hooks fire first, then monitor logging:

```typescript
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: {
    onToolCall: ({ toolName }) => {
      console.error(`[HOOK] Tool called: ${toolName}`);
    },
    onToolSuccess: ({ toolName, duration }) => {
      console.error(`[HOOK] Tool succeeded: ${toolName} (${duration}ms)`);
    },
  },
})
class MyServer {
  @Tool({ description: 'Test tool' })
  @Monitor({ logDuration: true })
  async testTool() {
    return 'result';
  }
}

// Output order:
// [HOOK] Tool called: testTool
// [Monitor] testTool completed { duration: "5ms" }
// [HOOK] Tool succeeded: testTool (5ms)
```

### Production Logging Example

```typescript
import { Monitor } from '@mcpkit-dev/core';
import pino from 'pino';

// Create pino logger that writes to stderr
const logger = pino({
  level: 'info',
}, pino.destination(2)); // fd 2 = stderr

const prodLogger = (message: string, data: Record<string, unknown>) => {
  logger.info(data, message);
};

const errorLogger = (message: string, data: Record<string, unknown>) => {
  logger.error(data, message);
};

@Tool({ description: 'Critical operation' })
@Monitor({
  logDuration: true,
  logErrors: true,
  logger: prodLogger,
  errorLogger: errorLogger,
})
async criticalOperation() {
  // ...
}
```

## Important: stdio Transport Compatibility

When using stdio transport (the default for Claude Desktop), **all logging must go to stderr**. Writing to stdout corrupts the JSON-RPC message stream.

MCPKit's `@Debug` decorator automatically uses `console.error` (stderr) for all log levels. If you provide a custom logger, ensure it writes to stderr:

```typescript
// CORRECT - writes to stderr
const logger: DebugLogger = {
  log(level, message, data) {
    console.error(`[${level}] ${message}`, data);
  },
};

// WRONG - writes to stdout, breaks stdio transport!
const badLogger: DebugLogger = {
  log(level, message, data) {
    console.log(`[${level}] ${message}`, data); // DON'T DO THIS
  },
};
```

## Combining @Debug and @Monitor

You can use both decorators together for different purposes:

```typescript
@Tool({ description: 'Complex operation' })
@Debug({
  enabled: process.env.NODE_ENV === 'development',
  logArgs: true,
  logResult: true,
})
@Monitor({
  logDuration: true,
  logErrors: true,
})
async complexOperation(@Param({ name: 'input' }) input: string) {
  // In development: Full debug output
  // In production: Just timing and errors via Monitor
}
```

## Best Practices

1. **Use @Debug for development**, disable in production for performance
2. **Use @Monitor for production** with minimal logging (duration, errors)
3. **Always sanitize sensitive data** when logging arguments
4. **Custom loggers must use stderr** for stdio transport compatibility
5. **Use global config** to enable/disable debug across all methods
6. **Log levels should match severity** - don't log debug info at error level

## See Also

- [Hooks Guide](./hooks.md) - Server lifecycle hooks
- [Observability Guide](../observability/overview.md) - Metrics, tracing, health checks
- [@Traced Decorator](./tracing-decorator.md) - Distributed tracing
