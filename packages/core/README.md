# @mcpkit-dev/core

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/core.svg)](https://www.npmjs.com/package/@mcpkit-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Core framework for building Model Context Protocol (MCP) servers with TypeScript decorators.

## Installation

```bash
npm install @mcpkit-dev/core reflect-metadata zod
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
  @Tool({ description: 'Greet someone' })
  greet(@Param({ description: 'Name to greet' }) name: string) {
    return `Hello, ${name}!`;
  }
}

const server = new MyServer();
await server.listen();
```

## Features

- **Decorators** - `@MCPServer`, `@Tool`, `@Resource`, `@Prompt`, `@Param`
- **Authentication** - API key, JWT, Bearer token middleware
- **Observability** - `@Debug`, `@Monitor`, `@Traced` decorators
- **Plugins** - Extensible plugin system with lifecycle hooks
- **Transports** - stdio, HTTP/SSE, Streamable HTTP

## Documentation

**[Read the full documentation](https://v-checha.github.io/mcpkit/)**

- [Getting Started](https://v-checha.github.io/mcpkit/docs/getting-started/installation)
- [Tools Guide](https://v-checha.github.io/mcpkit/docs/guides/tools)
- [Resources Guide](https://v-checha.github.io/mcpkit/docs/guides/resources)
- [Authentication](https://v-checha.github.io/mcpkit/docs/advanced/authentication)
- [Plugins](https://v-checha.github.io/mcpkit/docs/advanced/plugins-guide)
- [Observability](https://v-checha.github.io/mcpkit/docs/observability/overview)
- [API Reference](https://v-checha.github.io/mcpkit/docs/api/decorators)

## Using with Claude Desktop

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

## Related Packages

- [@mcpkit-dev/cli](https://www.npmjs.com/package/@mcpkit-dev/cli) - CLI for project scaffolding
- [@mcpkit-dev/testing](https://www.npmjs.com/package/@mcpkit-dev/testing) - Testing utilities

## License

MIT
