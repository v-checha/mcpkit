---
sidebar_position: 2
---

# Types

## Core Types

```typescript
interface ListenOptions {
  transport?: 'stdio' | 'http' | 'sse' | 'streamable-http';
  port?: number;
  host?: string;
  path?: string;
  ssePath?: string;
  messagePath?: string;
}

interface BootstrappedServer {
  server: McpServer;
  transport: Transport;
  connect(): Promise<void>;
  close(): Promise<void>;
}

interface ServerHooks {
  awaitHooks?: boolean;
  onServerStart?: () => void | Promise<void>;
  onServerStop?: () => void | Promise<void>;
  onToolCall?: (ctx: ToolCallContext) => void | Promise<void>;
  onToolSuccess?: (ctx: ToolSuccessContext) => void | Promise<void>;
  onToolError?: (ctx: ToolErrorContext) => void | Promise<void>;
  // ... resource and prompt hooks
}
```

## Server Instance Types

```typescript
/**
 * Interface for runtime methods added by @MCPServer decorator
 */
interface MCPServerInstance {
  listen(options?: ListenOptions): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Type helper that combines a class type with MCPServerInstance
 * Used by createServer() to return properly typed instances
 */
type WithMCPServer<T> = T & MCPServerInstance;
```

### Usage with `createServer`

```typescript
import { createServer, MCPServer, Tool } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Hello' })
  async hello(): Promise<string> {
    return 'Hello!';
  }
}

// createServer returns WithMCPServer<MyServer>
const server = createServer(MyServer);

// All methods are properly typed
await server.listen();           // MCPServerInstance method
await server.hello();            // MyServer method
console.log(server.isConnected()); // MCPServerInstance method
await server.close();            // MCPServerInstance method
```

### Usage with Declaration Merging

```typescript
import 'reflect-metadata';
import { MCPServer, type MCPServerInstance } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  // ... your tools
}

// Declaration merging adds MCPServerInstance methods to MyServer type
interface MyServer extends MCPServerInstance {}

const server = new MyServer();
await server.listen(); // TypeScript knows about this
```

## Middleware Types

```typescript
interface MiddlewareContext {
  request: IncomingMessage;
  response: ServerResponse;
  sessionId?: string;
  url: URL;
  method: string;
  path: string;
  body?: unknown;
  state: Map<string, unknown>;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

type Middleware = (ctx: MiddlewareContext, next: NextFunction) => Promise<void>;

interface AuthContext {
  authenticated: boolean;
  principal?: unknown;
  roles?: string[];
  claims?: Record<string, unknown>;
}
```

## Observability Types

```typescript
interface Span {
  name: string;
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode: SpanStatusCode;
  attributes: SpanAttributes;
  events: SpanEvent[];
  setAttribute(key: string, value: SpanAttributeValue): void;
  setStatus(code: SpanStatusCode, message?: string): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  recordException(error: Error): void;
  end(): void;
}
```
