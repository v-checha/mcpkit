# MCPKit

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/core.svg)](https://www.npmjs.com/package/@mcpkit-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Developer-friendly toolkit for building Model Context Protocol (MCP) servers with minimal boilerplate.

MCPKit provides a decorator-based, type-safe API for creating MCP servers that work with Claude, ChatGPT, Cursor, and other AI assistants.

## Features

- **Decorator-based API** - Clean, declarative syntax with `@MCPServer`, `@Tool`, `@Resource`, `@Prompt`, and `@Param`
- **Type-safe** - Full TypeScript support with automatic type inference
- **Multiple transports** - Support for stdio, HTTP/SSE, and Streamable HTTP
- **CLI tooling** - Project scaffolding and development tools
- **Testing utilities** - Mock clients and helpers for testing your servers
- **Zod integration** - Runtime validation with automatic JSON Schema generation
- **MCP SDK compatible** - Built on top of the official `@modelcontextprotocol/sdk`

## Packages

| Package | Description |
|---------|-------------|
| [@mcpkit-dev/core](./packages/core) | Core decorators and server framework |
| [@mcpkit-dev/cli](./packages/cli) | CLI tool for project scaffolding |
| [@mcpkit-dev/testing](./packages/testing) | Testing utilities and mock clients |

## Quick Start

### Using the CLI (Recommended)

```bash
# Install the CLI globally
npm install -g @mcpkit-dev/cli

# Create a new project
mcpkit init my-server

# Navigate and start development
cd my-server
npm run dev
```

### Manual Installation

```bash
npm install @mcpkit-dev/core zod
```

```typescript
import { MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Greet someone by name' })
  async greet(
    @Param({ description: 'Name to greet' }) name: string
  ): Promise<string> {
    return `Hello, ${name}!`;
  }
}

// Start the server
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
    tools: true,     // Enable tools (default: true)
    resources: true, // Enable resources (default: true)
    prompts: true,   // Enable prompts (default: true)
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
  @Param({ description: 'City name' }) city: string,
  @Param({ description: 'Temperature unit', optional: true }) unit?: 'celsius' | 'fahrenheit'
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

Parameter decorator for tool and prompt arguments.

```typescript
@Param({
  name: 'city',           // Optional - defaults to parameter name
  description: 'City',    // Optional - shown to AI
  schema: z.string(),     // Optional - explicit Zod schema
  optional: true,         // Optional - is parameter optional?
})
```

### @Resource

Method decorator that exposes data as an MCP resource.

```typescript
// URI template with parameters
@Resource({
  uri: 'weather://cities/{city}/current',
  name: 'City Weather',
  description: 'Current weather for a city',
})
async getCityWeather(city: string) {
  return JSON.stringify({ temperature: 22, city });
}

// Static resource
@Resource({
  uri: 'docs://readme',
  name: 'README',
  mimeType: 'text/markdown',
})
async getReadme() {
  return '# My Server\n\nDocumentation here...';
}
```

### @Prompt

Method decorator for reusable prompt templates.

```typescript
@Prompt({
  name: 'weather-report',
  description: 'Generate a weather report'
})
async weatherReport(
  @Param({ description: 'City name' }) city: string
) {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Write a detailed weather report for ${city}`,
      },
    }],
  };
}
```

## Transport Options

MCPKit supports multiple transport protocols:

### stdio (Default)

Standard input/output transport for CLI tools and Claude Desktop integration.

```typescript
const server = new MyServer();
await server.listen(); // Uses stdio by default
```

### Streamable HTTP (Recommended for Web)

Modern HTTP transport with session support and SSE streaming.

```typescript
const server = new MyServer();
await server.listen({
  transport: 'streamable-http',
  port: 3000,
  host: 'localhost',
  path: '/mcp',
});
// Server available at http://localhost:3000/mcp
```

### SSE (Legacy HTTP)

Server-Sent Events transport for backward compatibility.

```typescript
const server = new MyServer();
await server.listen({
  transport: 'sse',
  port: 3000,
  host: 'localhost',
  ssePath: '/sse',
  messagePath: '/message',
});
```

## CLI Tool

The `@mcpkit-dev/cli` package provides project scaffolding and development tools.

```bash
npm install -g @mcpkit-dev/cli
```

### Commands

```bash
# Create a new project
mcpkit init [name]
  --template <template>  Template to use (basic, advanced)
  --no-git              Skip git initialization
  --no-install          Skip installing dependencies

# Start development server
mcpkit dev
  --port <port>         Port for HTTP transport (default: 3000)
  --transport <type>    Transport type (stdio, http, streamable-http)
  --watch               Watch for file changes (default: true)

# Build for production
mcpkit build
  --output <dir>        Output directory (default: dist)
```

## Testing

The `@mcpkit-dev/testing` package provides utilities for testing MCP servers.

```bash
npm install -D @mcpkit-dev/testing
```

### Mock Client

```typescript
import { MockMcpClient } from '@mcpkit-dev/testing';
import { bootstrapServer, MetadataStorage } from '@mcpkit-dev/core';

describe('MyServer', () => {
  it('should greet users', async () => {
    // Create mock client
    const { client, serverTransport } = MockMcpClient.create();

    // Bootstrap server with test transport
    const instance = new MyServer();
    const options = MetadataStorage.getServerOptions(MyServer);
    const server = await bootstrapServer(instance, options!);
    await server.server.connect(serverTransport);
    await client.connect();

    // Test the tool
    const result = await client.callTool('greet', { name: 'World' });
    expect(result.content[0].text).toBe('Hello, World!');

    // Cleanup
    await client.close();
    await server.close();
  });
});
```

### In-Memory Transport

```typescript
import { InMemoryTransport } from '@mcpkit-dev/testing';

const { clientTransport, serverTransport } = InMemoryTransport.createPair();
// Use transports for direct client-server communication
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

- **[weather-server](./examples/weather-server)** - Demonstrates tools, resources, and prompts

## API Reference

### Listen Options

```typescript
interface ListenOptions {
  transport?: 'stdio' | 'http' | 'sse' | 'streamable-http';
  port?: number;           // HTTP port (default: 3000)
  host?: string;           // HTTP host (default: 'localhost')
  path?: string;           // Streamable HTTP endpoint path
  ssePath?: string;        // SSE stream path
  messagePath?: string;    // SSE message path
  stateless?: boolean;     // Disable session management
  enableJsonResponse?: boolean; // Use JSON instead of SSE
  onSessionInitialized?: (sessionId: string) => void;
  onSessionClosed?: (sessionId: string) => void;
}
```

### Server Instance

```typescript
interface BootstrappedServer {
  server: McpServer;        // Underlying MCP server
  transport: Transport;     // Active transport
  connect(): Promise<void>; // Start the server
  close(): Promise<void>;   // Stop the server
}
```

## Requirements

- Node.js 18+
- TypeScript 5.0+

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting a PR.

## License

MIT
