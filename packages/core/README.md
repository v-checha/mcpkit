# @mcpkit-dev/core

Developer-friendly toolkit for building Model Context Protocol (MCP) servers with decorators.

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/core.svg)](https://www.npmjs.com/package/@mcpkit-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Decorator-based API** - Clean, declarative syntax with `@MCPServer`, `@Tool`, `@Resource`, `@Prompt`, `@Param`, and `@Monitor`
- **Type-safe** - Full TypeScript support with automatic type inference
- **Minimal boilerplate** - Focus on your business logic, not protocol details
- **Zod integration** - Runtime validation with automatic JSON Schema generation
- **Lifecycle hooks** - Built-in logging and monitoring with `ServerHooks`
- **MCP SDK compatible** - Built on top of the official `@modelcontextprotocol/sdk`

## Installation

```bash
npm install @mcpkit-dev/core @modelcontextprotocol/sdk zod reflect-metadata
```

## Quick Start

```typescript
import 'reflect-metadata';
import { MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Greet someone by name' })
  async greet(
    @Param({ name: 'name', description: 'Name to greet' })
    name: string,
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
})
class WeatherServer {}
```

### @Tool

Method decorator that exposes a method as an MCP tool.

```typescript
// Using @Param decorators
@Tool({ description: 'Get current weather' })
async getWeather(
  @Param({ name: 'city', description: 'City name' }) city: string,
  @Param({ name: 'unit', optional: true }) unit?: 'celsius' | 'fahrenheit',
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

Parameter decorator for tool/prompt parameters.

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

// Static resource with options
@Resource({
  uri: 'docs://readme',
  name: 'README',
  mimeType: 'text/markdown',
})
async getReadme() {
  return { contents: [{ uri: 'docs://readme', text: '# README' }] };
}
```

### @Prompt

Method decorator that creates a reusable prompt template.

```typescript
@Prompt({ description: 'Generate a weather report' })
async weatherReport(
  @Param({ name: 'city' }) city: string,
) {
  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Write a weather report for ${city}` },
    }],
  };
}
```

### @Monitor

Method decorator for per-method monitoring and logging.

```typescript
@Tool({ description: 'Process important data' })
@Monitor({
  logArgs: true,      // Log input arguments
  logResult: true,    // Log return value
  logDuration: true,  // Log execution time (default: true)
  logErrors: true,    // Log errors (default: true)
  logger: customLogger, // Optional custom logger
})
async processData(@Param({ name: 'data' }) data: string) {
  return `Processed: ${data}`;
}
```

> Note: `@Monitor` only works when `hooks` are configured on `@MCPServer`.

## Lifecycle Hooks

Add logging, monitoring, and observability to your server with hooks:

```typescript
import { MCPServer, Tool, Param, type ServerHooks } from '@mcpkit-dev/core';

@MCPServer({
  name: 'monitored-server',
  version: '1.0.0',
  hooks: {
    // Whether to await hook execution (default: true)
    awaitHooks: true,

    // Server lifecycle
    onServerStart: () => console.log('Server started'),
    onServerStop: () => console.log('Server stopped'),

    // Tool hooks
    onToolCall: ({ toolName, args }) => {
      console.log(`Tool ${toolName} called with`, args);
    },
    onToolSuccess: ({ toolName, duration, result }) => {
      console.log(`Tool ${toolName} completed in ${duration}ms`);
    },
    onToolError: ({ toolName, error, duration }) => {
      console.error(`Tool ${toolName} failed after ${duration}ms:`, error.message);
    },

    // Resource hooks
    onResourceRead: ({ uri }) => console.log(`Reading resource: ${uri}`),
    onResourceSuccess: ({ uri, duration }) => console.log(`Resource read in ${duration}ms`),
    onResourceError: ({ uri, error }) => console.error(`Resource error: ${uri}`, error),

    // Prompt hooks
    onPromptGet: ({ promptName }) => console.log(`Getting prompt: ${promptName}`),
    onPromptSuccess: ({ promptName, duration }) => console.log(`Prompt ready in ${duration}ms`),
    onPromptError: ({ promptName, error }) => console.error(`Prompt error:`, error),
  },
})
class MonitoredServer {
  @Tool({ description: 'Example tool' })
  async example(@Param({ name: 'input' }) input: string) {
    return `Result: ${input}`;
  }
}
```

### Metrics Collection Example

```typescript
import { MCPServer, type ServerHooks } from '@mcpkit-dev/core';

const hooks: ServerHooks = {
  awaitHooks: false, // Fire-and-forget for better performance
  onToolSuccess: ({ toolName, duration }) => {
    metrics.histogram('mcp_tool_duration_ms', duration, { tool: toolName });
    metrics.counter('mcp_tool_calls_total', 1, { tool: toolName, status: 'success' });
  },
  onToolError: ({ toolName }) => {
    metrics.counter('mcp_tool_calls_total', 1, { tool: toolName, status: 'error' });
  },
};

@MCPServer({ name: 'metrics-server', version: '1.0.0', hooks })
class MetricsServer { /* ... */ }
```

## Server Lifecycle

```typescript
const server = new MyServer();

// Start the server (stdio transport)
await server.listen();

// Check connection status
console.log(server.isConnected()); // true

// Graceful shutdown
await server.close();
```

## Using with Claude Desktop

Add your server to Claude Desktop's configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Required TypeScript settings in `tsconfig.json`:

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

## Requirements

- Node.js 18+
- TypeScript 5.0+

## Links

- [GitHub Repository](https://github.com/v-checha/mcpkit)
- [Full Documentation](https://github.com/v-checha/mcpkit#readme)
- [Examples](https://github.com/v-checha/mcpkit/main/examples)

## License

MIT
