---
sidebar_position: 1
---

# Tools

Tools are the primary way to expose functionality in an MCP server. They represent actions that an AI assistant can invoke.

## Basic Tool

Use the `@Tool` decorator to expose a method as a tool:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add two numbers together' })
  async add(
    @Param({ description: 'First number' }) a: number,
    @Param({ description: 'Second number' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Tool Options

```typescript
@Tool({
  // Required: Description shown to the AI
  description: 'Fetch user data from the database',

  // Optional: Custom tool name (defaults to method name)
  name: 'fetch_user',

  // Optional: Explicit Zod schema for parameters
  schema: z.object({
    userId: z.string().uuid(),
    includeProfile: z.boolean().optional(),
  }),

  // Optional: Tool annotations for AI behavior hints
  annotations: {
    destructive: false,      // Does this tool modify data?
    requiresConfirmation: false, // Should the AI ask before executing?
    cacheable: true,         // Can results be cached?
  },
})
async fetchUser(args: { userId: string; includeProfile?: boolean }) {
  // implementation
}
```

## Parameter Types

### Using @Param Decorator

The `@Param` decorator allows fine-grained control over parameters:

```typescript
@Tool({ description: 'Create a user' })
async createUser(
  // Required parameter
  @Param({
    name: 'name',
    description: 'User full name',
  })
  name: string,

  // Optional parameter with default
  @Param({
    name: 'role',
    description: 'User role',
    optional: true,
  })
  role: 'admin' | 'user' = 'user',

  // Parameter with explicit schema
  @Param({
    name: 'age',
    schema: z.number().min(18).max(120),
  })
  age: number
): Promise<User> {
  // implementation
}
```

### Using Zod Schema

For complex parameter validation, use a Zod schema:

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(18),
  role: z.enum(['admin', 'user', 'moderator']).default('user'),
  settings: z.object({
    notifications: z.boolean().default(true),
    theme: z.enum(['light', 'dark']).default('light'),
  }).optional(),
});

@Tool({
  description: 'Create a new user account',
  schema: CreateUserSchema,
})
async createUser(args: z.infer<typeof CreateUserSchema>) {
  const { name, email, age, role, settings } = args;
  // implementation
}
```

## Return Types

Tools can return various types:

### String Response

```typescript
@Tool({ description: 'Greet user' })
async greet(@Param({ name: 'name' }) name: string): Promise<string> {
  return `Hello, ${name}!`;
}
```

### Object Response

Objects are automatically serialized to JSON:

```typescript
@Tool({ description: 'Get user' })
async getUser(@Param({ name: 'id' }) id: string): Promise<User> {
  return {
    id,
    name: 'John Doe',
    email: 'john@example.com',
  };
}
```

### MCP Tool Result

For full control over the response:

```typescript
import { ToolResult } from '@mcpkit-dev/core';

@Tool({ description: 'Process image' })
async processImage(
  @Param({ name: 'url' }) url: string
): Promise<ToolResult> {
  const image = await fetchImage(url);

  return {
    content: [
      {
        type: 'text',
        text: 'Image processed successfully',
      },
      {
        type: 'image',
        data: image.base64,
        mimeType: 'image/png',
      },
    ],
  };
}
```

## Error Handling

Errors are automatically caught and returned as tool errors:

```typescript
@Tool({ description: 'Fetch user' })
async fetchUser(@Param({ name: 'id' }) id: string) {
  const user = await db.users.findById(id);

  if (!user) {
    throw new Error(`User ${id} not found`);
  }

  return user;
}
```

For custom error handling:

```typescript
import { ToolExecutionError } from '@mcpkit-dev/core';

@Tool({ description: 'Transfer funds' })
async transfer(
  @Param({ name: 'from' }) from: string,
  @Param({ name: 'to' }) to: string,
  @Param({ name: 'amount' }) amount: number
) {
  if (amount <= 0) {
    throw new ToolExecutionError('Amount must be positive');
  }

  // implementation
}
```

## Protected Tools

Use `@RequireAuth` to protect tools:

```typescript
import { RequireAuth } from '@mcpkit-dev/core';

@Tool({ description: 'Delete user' })
@RequireAuth({ roles: ['admin'] })
async deleteUser(@Param({ name: 'id' }) id: string) {
  await db.users.delete(id);
  return { deleted: true };
}
```

## Monitored Tools

Add logging with `@Monitor`:

```typescript
import { Monitor } from '@mcpkit-dev/core';

@Tool({ description: 'Process payment' })
@Monitor({
  logArgs: true,
  logResult: true,
  logDuration: true,
})
async processPayment(@Param({ name: 'amount' }) amount: number) {
  // Execution will be logged
  return { success: true };
}
```

## Traced Tools

Add distributed tracing with `@Traced`:

```typescript
import { Traced } from '@mcpkit-dev/core';

@Tool({ description: 'External API call' })
@Traced({
  name: 'external.api.call',
  kind: 'client',
  attributes: { 'api.name': 'payment-service' },
})
async callExternalApi(@Param({ name: 'data' }) data: string) {
  return await externalApi.call(data);
}
```
