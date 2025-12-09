# MCPKit

Developer-friendly toolkit for building Model Context Protocol (MCP) servers with minimal boilerplate.

MCPKit provides a decorator-based, type-safe API for creating MCP servers that work with Claude, ChatGPT, Cursor, and other AI assistants.

## Features

- **Decorator-based API** - Clean, declarative syntax with `@MCPServer`, `@Tool`, `@Resource`, `@Prompt`, and `@Param`
- **Type-safe** - Full TypeScript support with automatic type inference
- **Minimal boilerplate** - Focus on your business logic, not protocol details
- **Zod integration** - Runtime validation with automatic JSON Schema generation
- **MCP SDK compatible** - Built on top of the official `@modelcontextprotocol/sdk`

## Installation

```bash
npm install @mcpkit/core @modelcontextprotocol/sdk zod
```

## Quick Start

```typescript
import 'reflect-metadata';
import { MCPServer, Tool, Param } from '@mcpkit/core';
import { z } from 'zod';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Greet someone by name' })
  async greet(
    @Param({ name: 'name', description: 'Name to greet' })
    name: string
  ): Promise<string> {
    return `Hello, ${name}!`;
  }
}

const server = new MyServer();
await server.listen();
```

## Decorators

### @MCPServer

Class decorator that marks a class as an MCP server.

```typescript
@MCPServer({
  name: 'weather-server',
  version: '1.0.0',
  description: 'Get weather information',
  capabilities: {
    tools: true,    // default: true
    resources: true, // default: true
    prompts: true,   // default: true
  },
})
class WeatherServer { ... }
```

### @Tool

Method decorator that exposes a method as an MCP tool.

```typescript
// Using @Param decorators
@Tool({ description: 'Get current weather' })
async getWeather(
  @Param({ name: 'city', description: 'City name' }) city: string,
  @Param({ name: 'unit', optional: true }) unit?: 'celsius' | 'fahrenheit'
): Promise<WeatherData> {
  // implementation
}

// Using explicit Zod schema
@Tool({
  description: 'Get forecast',
  schema: z.object({
    city: z.string(),
    days: z.number().min(1).max(7),
  }),
})
async getForecast(args: { city: string; days: number }) {
  // implementation
}
```

### @Param

Parameter decorator that provides metadata for tool/prompt parameters.

```typescript
@Param({
  name: 'city',           // Required - parameter name
  description: 'City',    // Optional - shown to AI
  schema: z.string(),     // Optional - explicit Zod schema
  optional: true,         // Optional - is parameter optional?
})
```

### @Resource

Method decorator that exposes data as an MCP resource.

```typescript
// URI template with parameters
@Resource('weather://cities/{city}/current')
async getCityWeather(city: string) {
  return {
    contents: [{
      uri: `weather://cities/${city}/current`,
      mimeType: 'application/json',
      text: JSON.stringify({ temperature: 22 }),
    }],
  };
}

// Static resource
@Resource({
  uri: 'docs://readme',
  name: 'README',
  mimeType: 'text/markdown',
})
async getReadme() { ... }
```

### @Prompt

Method decorator that creates a reusable prompt template.

```typescript
@Prompt({ description: 'Generate a weather report' })
async weatherReport(
  @Param({ name: 'city' }) city: string
) {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Write a weather report for ${city}`,
      },
    }],
  };
}
```

## Server Lifecycle

```typescript
const server = new MyServer();

// Start the server
await server.listen();
// Or with options:
await server.listen({ transport: 'stdio' });

// Check status
console.log(server.isConnected()); // true

// Graceful shutdown
await server.close();
```

## Using with Claude Desktop

Add your server to Claude Desktop's configuration:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/your/server/dist/index.js"]
    }
  }
}
```

## TypeScript Configuration

MCPKit requires the following TypeScript settings:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

## Examples

See the [examples](./examples) directory for complete working examples:

- **weather-server** - Demonstrates tools, resources, and prompts

## API Reference

### Types

```typescript
// Server options
interface MCPServerDecoratorOptions {
  name: string;
  version: string;
  description?: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

// Tool options
interface ToolDecoratorOptions {
  name?: string;
  description?: string;
  schema?: ZodTypeAny;
  annotations?: ToolAnnotations;
}

// Param options
interface ParamDecoratorOptions {
  name: string;
  description?: string;
  schema?: ZodTypeAny;
  optional?: boolean;
}

// Server instance methods (added by @MCPServer)
interface MCPServerInstance {
  listen(options?: ListenOptions): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
}
```

## Requirements

- Node.js 18+
- TypeScript 5.0+

## License

MIT
