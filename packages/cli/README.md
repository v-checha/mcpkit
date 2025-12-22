# @mcpkit-dev/cli

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/cli.svg)](https://www.npmjs.com/package/@mcpkit-dev/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI tool for creating and managing MCPKit MCP servers.

## Installation

```bash
npm install -g @mcpkit-dev/cli
```

## Quick Start

```bash
# Create a new project
npx @mcpkit-dev/cli init my-server

# Navigate and start development
cd my-server
npm run dev
```

## Commands

### `mcpkit init [name]`

Create a new MCP server project with interactive prompts.

```bash
mcpkit init my-server
```

Options:
- `-t, --template <template>` - Template to use (basic, advanced)
- `--no-git` - Skip git initialization
- `--no-install` - Skip installing dependencies

### `mcpkit dev`

Start the server in development mode with watch and auto-reload.

```bash
mcpkit dev
```

### `mcpkit build`

Build the server for production.

```bash
mcpkit build
```

## Documentation

**[Read the full documentation](https://v-checha.github.io/mcpkit/)**

- [Getting Started](https://v-checha.github.io/mcpkit/docs/getting-started/installation)
- [Quick Start](https://v-checha.github.io/mcpkit/docs/getting-started/quick-start)

## Related Packages

- [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) - Core framework
- [@mcpkit-dev/testing](https://www.npmjs.com/package/@mcpkit-dev/testing) - Testing utilities

## License

MIT
