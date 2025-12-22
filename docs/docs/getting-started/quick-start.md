---
sidebar_position: 2
---

# Quick Start

Let's build a simple MCP server that provides weather information.

## Creating Your First Server

Create a new file `server.ts`:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Resource, Prompt, Param } from '@mcpkit-dev/core';

@MCPServer({
  name: 'weather-server',
  version: '1.0.0',
  description: 'A weather information server',
})
class WeatherServer {
  // Define a tool
  @Tool({ description: 'Get current weather for a city' })
  async getWeather(
    @Param({ description: 'City name' }) city: string,
    @Param({ description: 'Temperature unit', optional: true })
    unit: 'celsius' | 'fahrenheit' = 'celsius'
  ): Promise<string> {
    // In a real app, you'd call a weather API
    const temp = unit === 'celsius' ? '22°C' : '72°F';
    return `The weather in ${city} is ${temp} and sunny.`;
  }

  // Define a resource
  @Resource('weather://cities')
  async getCities() {
    return {
      contents: [{
        uri: 'weather://cities',
        mimeType: 'application/json',
        text: JSON.stringify(['New York', 'London', 'Tokyo', 'Sydney']),
      }],
    };
  }

  // Define a prompt
  @Prompt({ description: 'Generate a weather report' })
  async weatherReport(
    @Param({ name: 'city' }) city: string
  ) {
    return {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Write a detailed weather report for ${city}, including temperature, humidity, and forecast.`,
        },
      }],
    };
  }
}

// Start the server
const server = createServer(WeatherServer);
await server.listen();
```

## Understanding Server Instantiation

The `@MCPServer` decorator adds `listen()`, `close()`, and `isConnected()` methods to your class at runtime. Since TypeScript doesn't know about these runtime-added methods, we provide several ways to get proper typing:

### Option 1: `createServer` Factory (Recommended)

The simplest approach - use the `createServer` factory function:

```typescript
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add numbers' })
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

// Properly typed - no type assertions needed!
const server = createServer(MyServer);
await server.listen();
```

If your server class has constructor parameters:

```typescript
@MCPServer({ name: 'configurable-server', version: '1.0.0' })
class ConfigurableServer {
  constructor(private config: { apiKey: string }) {}

  @Tool({ description: 'Get API key' })
  async getApiKey(): Promise<string> {
    return this.config.apiKey;
  }
}

// Pass constructor arguments after the class
const server = createServer(ConfigurableServer, { apiKey: 'secret' });
await server.listen();
```

### Option 2: Declaration Merging

Use TypeScript's declaration merging to extend your class interface:

```typescript
import 'reflect-metadata';
import { MCPServer, Tool, Param, type MCPServerInstance } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add numbers' })
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

// Declaration merging - tells TypeScript about runtime methods
interface MyServer extends MCPServerInstance {}

const server = new MyServer();
await server.listen(); // TypeScript knows about listen()
```

### Option 3: Type Assertion

Use a type assertion when instantiating:

```typescript
import 'reflect-metadata';
import { MCPServer, Tool, Param, type MCPServerInstance } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add numbers' })
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

const server = new MyServer() as MyServer & MCPServerInstance;
await server.listen();
```

## Running Your Server

### With stdio (Default)

The default transport is stdio, which is used by Claude Desktop and other CLI-based clients:

```bash
npx tsx server.ts
```

### With HTTP

For web-based integrations, use the Streamable HTTP transport:

```typescript
await server.listen({
  transport: 'streamable-http',
  port: 3000,
  path: '/mcp',
});
```

## Testing Your Server

Use the testing package to write tests:

```typescript
import { describe, it, expect } from 'vitest';
import { MockMcpClient } from '@mcpkit-dev/testing';
import { bootstrapServer, MetadataStorage } from '@mcpkit-dev/core';

describe('WeatherServer', () => {
  it('should get weather for a city', async () => {
    const { client, serverTransport } = MockMcpClient.create();

    const instance = new WeatherServer();
    const options = MetadataStorage.getServerOptions(WeatherServer);
    const server = await bootstrapServer(instance, options!);
    await server.server.connect(serverTransport);
    await client.connect();

    const result = await client.callTool('getWeather', { city: 'Tokyo' });

    expect(result.content[0].text).toContain('Tokyo');
    expect(result.content[0].text).toContain('sunny');

    await client.close();
    await server.close();
  });
});
```

## Using with Claude Desktop

Add your server to Claude Desktop's configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/path/to/your/server/dist/server.js"]
    }
  }
}
```

## Next Steps

- [Tools Guide](/docs/guides/tools) - Learn about defining tools
- [Resources Guide](/docs/guides/resources) - Expose data as resources
- [Prompts Guide](/docs/guides/prompts) - Create reusable prompts
- [Authentication](/docs/advanced/authentication) - Secure your server
