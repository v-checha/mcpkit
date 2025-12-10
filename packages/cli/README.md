# @mcpkit-dev/cli

CLI tool for creating and managing MCPKit MCP servers.

## Installation

```bash
# Install globally
npm install -g @mcpkit-dev/cli

# Or use with npx
npx @mcpkit-dev/cli init my-server
```

## Commands

### `mcpkit init [name]`

Create a new MCP server project with interactive prompts.

```bash
mcpkit init my-server
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <template>` | Template to use (basic, advanced) | `basic` |
| `--typescript` | Use TypeScript | `true` |
| `--no-git` | Skip git initialization | - |
| `--no-install` | Skip installing dependencies | - |

**Interactive prompts:**

- **Project name** - Name of your MCP server
- **Description** - Brief description of your server
- **Author** - Your name or organization
- **Transport** - Default transport type (stdio, streamable-http, sse)

**Generated project structure:**

```
my-server/
├── src/
│   └── index.ts      # Main server file
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### `mcpkit dev`

Start the MCP server in development mode with watch and auto-reload.

```bash
mcpkit dev
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port for HTTP transport | `3000` |
| `--transport <type>` | Transport type (stdio, http, streamable-http) | `stdio` |
| `--watch` | Watch for file changes | `true` |

**Environment variables set:**

- `MCPKIT_TRANSPORT` - Transport type
- `MCPKIT_PORT` - HTTP port
- `NODE_ENV` - Set to `development`

### `mcpkit build`

Build the MCP server for production.

```bash
mcpkit build
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `dist` |

**Build process:**

1. Runs TypeScript type checking (`tsc --noEmit`)
2. Builds with tsup (ESM output)
3. Generates type declarations

## Quick Start

```bash
# Create a new project
mcpkit init weather-server

# Answer the prompts
? Project name: weather-server
? Project description: Weather information MCP server
? Author: Your Name
? Default transport: stdio (recommended for CLI tools)

# Navigate to the project
cd weather-server

# Start development
npm run dev
```

## Generated Server Example

The `init` command generates a fully working MCP server:

```typescript
import { MCPServer, Tool, Resource, Prompt, Param, listen } from '@mcpkit-dev/core';

@MCPServer({
  name: 'weather-server',
  version: '0.1.0',
})
class Server {
  @Tool({ description: 'Say hello to someone' })
  async greet(@Param({ description: 'Name to greet' }) name: string): Promise<string> {
    return `Hello, ${name}! Welcome to weather-server.`;
  }

  @Resource({
    uri: 'info://server',
    name: 'Server Info',
    description: 'Get information about this server',
  })
  async getServerInfo(): Promise<string> {
    return JSON.stringify({
      name: 'weather-server',
      version: '0.1.0',
    }, null, 2);
  }

  @Prompt({
    name: 'help',
    description: 'Get help using this server',
  })
  async helpPrompt() {
    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: 'How do I use this server?' },
        },
      ],
    };
  }
}

const server = new Server();
await server.listen();
```

## Using with Claude Desktop

After building your server, add it to Claude Desktop:

```json
{
  "mcpServers": {
    "weather-server": {
      "command": "node",
      "args": ["/path/to/weather-server/dist/index.js"]
    }
  }
}
```

## Requirements

- Node.js 18+
- npm or yarn

## Related Packages

- [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) - Core decorators and server framework
- [@mcpkit-dev/testing](https://www.npmjs.com/package/@mcpkit-dev/testing) - Testing utilities

## License

MIT
