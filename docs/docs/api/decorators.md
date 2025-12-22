---
sidebar_position: 1
---

# Decorators

## Class Decorators

### @MCPServer

Marks a class as an MCP server.

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

Adds debug logging to a method.

```typescript
@Debug({
  enabled?: boolean;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  logArgs?: boolean;
  logResult?: boolean;
  sanitize?: (key, value) => unknown;
})
```

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
