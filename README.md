# MCPKit

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/core.svg)](https://www.npmjs.com/package/@mcpkit-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Developer-friendly toolkit for building Model Context Protocol (MCP) servers with minimal boilerplate.

MCPKit provides a decorator-based, type-safe API for creating MCP servers that work with Claude, ChatGPT, Cursor, and
other AI assistants.

## Features

- **Decorator-based API** - Clean, declarative syntax with `@MCPServer`, `@Tool`, `@Resource`, `@Prompt`, and `@Param`
- **Type-safe** - Full TypeScript support with automatic type inference
- **Multiple transports** - Support for stdio, HTTP/SSE, and Streamable HTTP
- **Authentication** - Built-in support for API key, JWT, and OAuth bearer token authentication
- **Rate limiting** - Configurable rate limiting with multiple strategies
- **Plugin system** - Extensible architecture with lifecycle hooks
- **Server composition** - Combine multiple servers into a unified API
- **Gateway** - Proxy and load balance across upstream MCP servers
- **Observability** - Prometheus metrics, health checks, and distributed tracing
- **CLI tooling** - Project scaffolding and development tools
- **Testing utilities** - Mock clients and helpers for testing your servers
- **Zod integration** - Runtime validation with automatic JSON Schema generation
- **MCP SDK compatible** - Built on top of the official `@modelcontextprotocol/sdk`

## Packages

| Package                                   | Description                          |
|-------------------------------------------|--------------------------------------|
| [@mcpkit-dev/core](./packages/core)       | Core decorators and server framework |
| [@mcpkit-dev/cli](./packages/cli)         | CLI tool for project scaffolding     |
| [@mcpkit-dev/testing](./packages/testing) | Testing utilities and mock clients   |

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
  middleware: [rateLimit({ maxRequests: 100 })],
  plugins: [metricsPlugin()],
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

Method decorator for reusable prompt templates.

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

### @Debug

Method decorator for enhanced debug logging.

```typescript
@Tool({ description: 'Process data' })
@Debug({
  enabled: true,
  level: 'debug',
  logArgs: true,
  logResult: true,
  sanitize: (key, value) => {
    if (key.includes('password')) return '[REDACTED]';
    return value;
  },
})
async processData(@Param({ name: 'input' }) input: string) {
  return { processed: input };
}
```

### @RequireAuth

Method decorator for protecting tools/resources with authentication.

```typescript
import { RequireAuth, jwtAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'secure-server',
  version: '1.0.0',
  middleware: [jwtAuth({ secret: process.env.JWT_SECRET })],
})
class SecureServer {
  // Simple authentication requirement
  @Tool({ description: 'Protected tool' })
  @RequireAuth()
  async protectedTool(@Param({ name: 'data' }) data: string) {
    return `Protected: ${data}`;
  }

  // Role-based access control
  @Tool({ description: 'Admin only operation' })
  @RequireAuth({ roles: ['admin'] })
  async adminTool(@Param({ name: 'data' }) data: string) {
    return `Admin: ${data}`;
  }

  // Custom validation
  @Tool({ description: 'Premium feature' })
  @RequireAuth({
    validate: (auth) => auth.claims?.subscription === 'premium',
    message: 'Premium subscription required',
  })
  async premiumTool(@Param({ name: 'data' }) data: string) {
    return `Premium: ${data}`;
  }
}
```

### @Traced

Method decorator for automatic distributed tracing.

```typescript
import { Traced, setGlobalTracer, createTracer, consoleExporter } from '@mcpkit-dev/core';

// Setup tracer
const tracer = createTracer({
  serviceName: 'my-server',
  exporters: [consoleExporter()],
});
setGlobalTracer(tracer);

@MCPServer({ name: 'traced-server', version: '1.0.0' })
class TracedServer {
  @Tool({ description: 'Fetch user' })
  @Traced({
    name: 'user.fetch',
    kind: 'client',
    attributes: { 'db.system': 'postgresql' },
    extractAttributes: (userId) => ({ 'user.id': userId }),
    recordResult: true,
  })
  async getUser(@Param({ name: 'userId' }) userId: string) {
    return { id: userId, name: 'John' };
  }
}
```

## Authentication

MCPKit provides built-in authentication middleware for HTTP transports.

### API Key Authentication

```typescript
import { apiKeyAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'api-server',
  version: '1.0.0',
  middleware: [
    apiKeyAuth({
      header: 'X-API-Key',
      validate: async (key) => {
        const user = await db.findUserByApiKey(key);
        return user ? { userId: user.id } : null;
      },
    }),
  ],
})
class ApiServer {}
```

### JWT Authentication

```typescript
import { jwtAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'jwt-server',
  version: '1.0.0',
  middleware: [
    jwtAuth({
      secret: process.env.JWT_SECRET,
      issuer: 'my-app',
      algorithms: ['HS256'],
    }),
  ],
})
class JwtServer {}
```

### Bearer Token (OAuth)

```typescript
import { bearerAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'oauth-server',
  version: '1.0.0',
  middleware: [
    bearerAuth({
      validate: async (token) => {
        const result = await oauthServer.introspect(token);
        return {
          valid: result.active,
          principal: { userId: result.sub },
          roles: result.scope?.split(' '),
        };
      },
    }),
  ],
})
class OAuthServer {}
```

## Rate Limiting

```typescript
import { rateLimit, MemoryRateLimitStore } from '@mcpkit-dev/core';

@MCPServer({
  name: 'rate-limited-server',
  version: '1.0.0',
  middleware: [
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (ctx) => ctx.get('auth')?.principal?.userId ?? ctx.request.socket.remoteAddress,
      store: new MemoryRateLimitStore(),
    }),
  ],
})
class RateLimitedServer {}
```

## Plugin System

Create reusable plugins to extend MCPKit functionality.

```typescript
import { createPlugin, type PluginContext } from '@mcpkit-dev/core';

const myPlugin = createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'A custom plugin',

  // Lifecycle hooks
  onRegister: (ctx: PluginContext) => {
    console.log('Plugin registered');
  },
  onServerStart: async () => {
    console.log('Server starting');
  },
  onServerStop: async () => {
    console.log('Server stopping');
  },

  // Add hooks
  hooks: {
    onToolCall: ({ toolName }) => {
      console.log(`Tool called: ${toolName}`);
    },
  },

  // Add middleware
  middleware: [myMiddleware],

  // Expose API
  api: {
    customMethod: () => 'hello',
  },
});

@MCPServer({
  name: 'pluggable-server',
  version: '1.0.0',
  plugins: [myPlugin],
})
class PluggableServer {}
```

### Built-in Plugins

```typescript
import { metricsPlugin, healthPlugin, tracingPlugin } from '@mcpkit-dev/core';

@MCPServer({
  name: 'observable-server',
  version: '1.0.0',
  plugins: [
    metricsPlugin({ prefix: 'myapp_' }),
    healthPlugin({
      checks: [
        { name: 'db', check: async () => ({ status: 'healthy' }) },
      ],
    }),
    tracingPlugin({
      serviceName: 'my-server',
      exporters: [consoleExporter()],
    }),
  ],
})
class ObservableServer {}
```

## Server Composition

Combine multiple MCP servers into a single unified server.

```typescript
import { composeServers, createComposedServer } from '@mcpkit-dev/core';

// Define individual servers
@MCPServer({ name: 'weather', version: '1.0.0' })
class WeatherServer {
  @Tool({ description: 'Get weather' })
  async getWeather(@Param({ name: 'city' }) city: string) {
    return `Weather in ${city}`;
  }
}

@MCPServer({ name: 'news', version: '1.0.0' })
class NewsServer {
  @Tool({ description: 'Get news' })
  async getNews(@Param({ name: 'topic' }) topic: string) {
    return `News about ${topic}`;
  }
}

// Compose servers with prefixes
const ComposedServer = createComposedServer({
  name: 'combined-server',
  version: '1.0.0',
  servers: [
    { instance: new WeatherServer(), toolPrefix: 'weather_' },
    { instance: new NewsServer(), toolPrefix: 'news_' },
  ],
});

const server = new ComposedServer();
await server.listen();
// Tools: weather_getWeather, news_getNews
```

## Gateway

Create a gateway to proxy and load balance across multiple upstream MCP servers.

```typescript
import { createGateway } from '@mcpkit-dev/core';

const gateway = createGateway({
  name: 'api-gateway',
  version: '1.0.0',
  upstreams: [
    {
      url: 'http://weather-server:3000',
      toolPrefix: 'weather_',
      healthCheck: true,
    },
    {
      url: 'http://news-server:3000',
      toolPrefix: 'news_',
      healthCheck: true,
    },
  ],
  loadBalancing: 'round-robin', // 'random' | 'weighted' | 'least-connections'
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
  },
  onUpstreamUnhealthy: (upstream, error) => {
    console.error(`Upstream ${upstream.url} is down:`, error.message);
  },
  onUpstreamRecovered: (upstream) => {
    console.log(`Upstream ${upstream.url} recovered`);
  },
});

await gateway.start();
```

## Observability

### Prometheus Metrics

```typescript
import { createMetricsCollector, metricsPlugin } from '@mcpkit-dev/core';

// Using plugin
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [metricsPlugin({ prefix: 'myapp_' })],
})
class MyServer {}

// Manual usage
const metrics = createMetricsCollector({ prefix: 'myapp_' });

// Use as hooks
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: metrics.getHooks(),
})
class MyServer {}

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.export());
});
```

### Health Checks

```typescript
import { createHealthChecker, healthMiddleware, healthPlugin } from '@mcpkit-dev/core';

// Using plugin
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    healthPlugin({
      checks: [
        {
          name: 'database',
          critical: true,
          check: async () => {
            await db.ping();
            return { status: 'healthy' };
          },
        },
        {
          name: 'cache',
          critical: false,
          check: async () => {
            const connected = await cache.ping();
            return {
              status: connected ? 'healthy' : 'degraded',
              message: connected ? undefined : 'Cache unavailable',
            };
          },
        },
      ],
    }),
  ],
})
class MyServer {}

// Endpoints:
// GET /health - Aggregated status
// GET /health/live - Liveness probe
// GET /health/ready - Readiness probe
```

### Distributed Tracing

```typescript
import {
  createTracer,
  consoleExporter,
  memoryExporter,
  tracingPlugin,
  Traced,
  setGlobalTracer,
} from '@mcpkit-dev/core';

// Setup tracer
const tracer = createTracer({
  serviceName: 'my-mcp-server',
  serviceVersion: '1.0.0',
  exporters: [consoleExporter()],
  maxBufferSize: 100,
  exportIntervalMs: 5000,
});

setGlobalTracer(tracer);

// Use via plugin
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    tracingPlugin({
      serviceName: 'my-mcp-server',
      exporters: [consoleExporter()],
    }),
  ],
})
class MyServer {}

// Manual span creation
const span = tracer.startSpan('my-operation', { kind: 'server' });
span.setAttribute('user.id', '123');
try {
  await doSomething();
  span.setStatus('ok');
} catch (error) {
  span.recordException(error);
} finally {
  span.end();
}

// Using withSpan helper
const result = await tracer.withSpan('my-operation', async (span) => {
  span.setAttribute('custom.attr', 'value');
  return await doSomething();
});
```

## Lifecycle Hooks

Add logging, monitoring, and observability to your server with hooks:

```typescript
import { MCPServer, Tool, Param, type ServerHooks } from '@mcpkit-dev/core';

@MCPServer({
  name: 'monitored-server',
  version: '1.0.0',
  hooks: {
    awaitHooks: true,

    // Server lifecycle
    onServerStart: () => console.error('Server started'),
    onServerStop: () => console.error('Server stopped'),

    // Tool hooks
    onToolCall: ({ toolName, args }) => {
      console.error(`Tool ${toolName} called with`, args);
    },
    onToolSuccess: ({ toolName, duration, result }) => {
      console.error(`Tool ${toolName} completed in ${duration}ms`);
    },
    onToolError: ({ toolName, error, duration }) => {
      console.error(`Tool ${toolName} failed after ${duration}ms:`, error.message);
    },

    // Resource hooks
    onResourceRead: ({ uri }) => console.error(`Reading resource: ${uri}`),
    onResourceSuccess: ({ uri, duration }) => console.error(`Resource read in ${duration}ms`),
    onResourceError: ({ uri, error }) => console.error(`Resource error: ${uri}`, error),

    // Prompt hooks
    onPromptGet: ({ promptName }) => console.error(`Getting prompt: ${promptName}`),
    onPromptSuccess: ({ promptName, duration }) => console.error(`Prompt ready in ${duration}ms`),
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

# Generate documentation
mcpkit docs generate
  --format <format>     Output format (json, markdown, openapi)
  --output <file>       Output file path
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

Add your server to Claude Desktop's configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on
macOS):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": [
        "/path/to/your/server/dist/index.js"
      ]
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
