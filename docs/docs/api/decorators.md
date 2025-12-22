---
sidebar_position: 1
---

# Decorators

## Class Decorators

### @MCPServer

Marks a class as an MCP server. This decorator adds `listen()`, `close()`, and `isConnected()` methods to your class at runtime.

```typescript
@MCPServer({
  name: string;
  version: string;
  description?: string;
  capabilities?: { tools?: boolean; resources?: boolean; prompts?: boolean };
  hooks?: ServerHooks;
  middleware?: Middleware[];
  plugins?: Plugin[];
})
```

#### TypeScript Typing

Since the decorator adds methods at runtime, TypeScript doesn't automatically know about them. Use one of these approaches:

**Recommended: `createServer` factory**

```typescript
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Greet someone' })
  async greet(@Param({ name: 'name' }) name: string): Promise<string> {
    return `Hello, ${name}!`;
  }
}

const server = createServer(MyServer);
await server.listen();
```

**Alternative: Declaration merging**

```typescript
import 'reflect-metadata';
import { MCPServer, type MCPServerInstance } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  // ... tools, resources, prompts
}

// Tell TypeScript about runtime methods
interface MyServer extends MCPServerInstance {}

const server = new MyServer();
await server.listen();
```

See [Quick Start](/docs/getting-started/quick-start#understanding-server-instantiation) for more details.

## Factory Functions

### createServer

Creates a properly typed server instance from a class decorated with `@MCPServer`.

```typescript
function createServer<T>(
  ServerClass: new (...args: any[]) => T,
  ...args: ConstructorParameters<typeof ServerClass>
): T & MCPServerInstance
```

**Example:**

```typescript
import { createServer, MCPServer, Tool } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Hello' })
  async hello(): Promise<string> {
    return 'Hello!';
  }
}

// No type assertions needed
const server = createServer(MyServer);
await server.listen();
await server.close();
console.log(server.isConnected()); // false
```

**With constructor arguments:**

```typescript
@MCPServer({ name: 'db-server', version: '1.0.0' })
class DatabaseServer {
  constructor(private connectionString: string) {}
}

const server = createServer(DatabaseServer, 'postgres://localhost/mydb');
```

## Method Decorators

### @Tool

Exposes a method as an MCP tool.

```typescript
@Tool({
  description: string;
  name?: string;
  schema?: ZodSchema;
  annotations?: ToolAnnotations;
})
```

### @Resource

Exposes a method as an MCP resource.

```typescript
@Resource(uri: string)
@Resource({
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
})
```

### @Prompt

Exposes a method as an MCP prompt.

```typescript
@Prompt({
  description: string;
  name?: string;
})
```

### @RequireAuth

Protects a method with authentication.

```typescript
@RequireAuth({
  roles?: string[];
  claims?: Record<string, unknown>;
  validate?: (auth: AuthContext) => boolean | Promise<boolean>;
  message?: string;
})
```

### @Traced

Adds distributed tracing to a method.

```typescript
@Traced({
  name?: string;
  kind?: 'internal' | 'server' | 'client';
  attributes?: SpanAttributes;
  extractAttributes?: (...args) => SpanAttributes;
  recordResult?: boolean;
})
```

### @Monitor

Adds logging/monitoring to a method.

```typescript
@Monitor({
  logArgs?: boolean;
  logResult?: boolean;
  logDuration?: boolean;
  logErrors?: boolean;
  logger?: Logger;
})
```

### @Debug

Adds debug logging to a method. Useful for troubleshooting MCP servers running in Claude Desktop.

```typescript
@Debug({
  enabled?: boolean;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  logArgs?: boolean;
  logResult?: boolean;
  logDuration?: boolean;
  label?: string;
  logger?: DebugLogger;
  sanitize?: (key, value) => unknown;
})
```

**Basic usage:**

```typescript
@Tool({ description: 'Add numbers' })
@Debug()
async add(@Param({ name: 'a' }) a: number, @Param({ name: 'b' }) b: number): Promise<number> {
  return a + b;
}
```

**With custom file logger:**

```typescript
import { configureDebug, type DebugLogger, type DebugLevel } from '@mcpkit-dev/core';
import { appendFileSync } from 'fs';

const fileLogger: DebugLogger = {
  log(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
    const logLine = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data }) + '\n';
    appendFileSync('./logs/mcp-server.log', logLine);
  },
};

configureDebug({ enabled: true, logger: fileLogger });
```

See [Debugging Guide](/docs/observability/debugging) for complete examples including file logging setup.

## Parameter Decorators

### @Param

Defines a tool or prompt parameter.

```typescript
@Param({
  name?: string;
  description?: string;
  schema?: ZodSchema;
  optional?: boolean;
})
```
