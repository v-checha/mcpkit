# MCPKit

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/core.svg)](https://www.npmjs.com/package/@mcpkit-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, decorator-based framework for building Model Context Protocol (MCP) servers in TypeScript.

## Why MCPKit?

- **Decorator-based API** - Clean, declarative syntax inspired by NestJS
- **Type-safe** - Full TypeScript support with automatic type inference
- **Production-ready** - Built-in auth, rate limiting, metrics, tracing, and health checks
- **Extensible** - Plugin system for reusable functionality
- **Multiple transports** - stdio, HTTP/SSE, and Streamable HTTP support

## Quick Start

```bash
npx @mcpkit-dev/cli init my-server
cd my-server
npm run dev
```

Or install manually:

```bash
npm install @mcpkit-dev/core reflect-metadata zod
```

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Greet someone' })
  greet(@Param({ name: 'name', description: 'Name to greet' }) name: string) {
    return `Hello, ${name}!`;
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Documentation

**[Read the full documentation](https://v-checha.github.io/mcpkit/)**

- [Getting Started](https://v-checha.github.io/mcpkit/docs/getting-started/installation)
- [Tools, Resources & Prompts](https://v-checha.github.io/mcpkit/docs/guides/tools)
- [Authentication](https://v-checha.github.io/mcpkit/docs/advanced/authentication)
- [Plugins](https://v-checha.github.io/mcpkit/docs/advanced/plugins-guide)
- [Observability](https://v-checha.github.io/mcpkit/docs/observability/overview)
- [API Reference](https://v-checha.github.io/mcpkit/docs/api/decorators)

## Packages

| Package | Description |
|---------|-------------|
| [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) | Core framework with decorators and server |
| [@mcpkit-dev/cli](https://www.npmjs.com/package/@mcpkit-dev/cli) | CLI for project scaffolding |
| [@mcpkit-dev/testing](https://www.npmjs.com/package/@mcpkit-dev/testing) | Testing utilities and mock clients |

## Using with Claude Desktop

Add to your Claude Desktop config:

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

## Requirements

- Node.js 18+
- TypeScript 5.0+

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md).

## License

MIT
