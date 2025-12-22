---
sidebar_position: 1
---

# Introduction

Welcome to **MCPKit** - the developer-friendly toolkit for building Model Context Protocol (MCP) servers with minimal boilerplate.

## What is MCPKit?

MCPKit provides a decorator-based, type-safe API for creating MCP servers that work with Claude, ChatGPT, Cursor, and other AI assistants. It's built on top of the official `@modelcontextprotocol/sdk` and adds a layer of developer ergonomics that makes building MCP servers a joy.

## Key Features

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

## Quick Example

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Greet someone by name' })
  async greet(
    @Param({ name: 'name', description: 'Name to greet' }) name: string
  ): Promise<string> {
    return `Hello, ${name}!`;
  }
}

// Start the server
const server = createServer(MyServer);
await server.listen();
```

## Packages

| Package | Description |
|---------|-------------|
| [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) | Core decorators and server framework |
| [@mcpkit-dev/cli](https://www.npmjs.com/package/@mcpkit-dev/cli) | CLI tool for project scaffolding |
| [@mcpkit-dev/testing](https://www.npmjs.com/package/@mcpkit-dev/testing) | Testing utilities and mock clients |

## Next Steps

- [Installation](/docs/getting-started/installation) - Get MCPKit set up in your project
- [Quick Start](/docs/getting-started/quick-start) - Build your first MCP server
- [Guides](/docs/guides/tools) - Learn about tools, resources, and prompts
