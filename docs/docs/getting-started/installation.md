---
sidebar_position: 1
---

# Installation

There are two ways to get started with MCPKit: using the CLI (recommended) or manual installation.

## Using the CLI (Recommended)

The quickest way to get started is with the MCPKit CLI, which scaffolds a complete project for you.

```bash
# Install the CLI globally
npm install -g @mcpkit-dev/cli

# Create a new project
mcpkit init my-server

# Navigate and start development
cd my-server
npm run dev
```

The CLI creates a project with:
- TypeScript configuration with proper decorator support
- Sample server with tools, resources, and prompts
- Testing setup with Vitest
- Build configuration
- Development scripts

## Manual Installation

If you prefer to add MCPKit to an existing project:

```bash
npm install @mcpkit-dev/core reflect-metadata zod
```

Or with your preferred package manager:

```bash
# yarn
yarn add @mcpkit-dev/core reflect-metadata zod

# pnpm
pnpm add @mcpkit-dev/core reflect-metadata zod
```

### Required Dependencies

- **reflect-metadata** - Required for TypeScript decorator metadata
- **zod** - Recommended for runtime validation and schema definitions

:::tip Important

Always import `reflect-metadata` at the top of your entry file:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer } from '@mcpkit-dev/core';
```

:::

## Development Dependencies

For testing your MCP servers, install the testing package:

```bash
npm install -D @mcpkit-dev/testing
```

## Requirements

- **Node.js 18+** - MCPKit uses modern JavaScript features
- **TypeScript 5.0+** - Required for decorator support

## Next Steps

Once installed, proceed to:
- [TypeScript Configuration](/docs/getting-started/typescript-config) - Set up TypeScript properly
- [Quick Start](/docs/getting-started/quick-start) - Build your first server
