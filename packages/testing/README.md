# @mcpkit-dev/testing

[![npm version](https://img.shields.io/npm/v/@mcpkit-dev/testing.svg)](https://www.npmjs.com/package/@mcpkit-dev/testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Testing utilities for MCPKit MCP servers.

## Installation

```bash
npm install -D @mcpkit-dev/testing
```

## Quick Start

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMcpClient } from '@mcpkit-dev/testing';
import { bootstrapServer, MetadataStorage } from '@mcpkit-dev/core';
import { MyServer } from './my-server';

describe('MyServer', () => {
  let client: MockMcpClient;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const { client: mockClient, serverTransport } = MockMcpClient.create();
    client = mockClient;

    const instance = new MyServer();
    const options = MetadataStorage.getServerOptions(MyServer);
    const server = await bootstrapServer(instance, options!);
    await server.server.connect(serverTransport);
    await client.connect();

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should call a tool', async () => {
    const result = await client.callTool('greet', { name: 'World' });
    expect(result.content[0].text).toBe('Hello, World!');
  });
});
```

## Features

- **MockMcpClient** - Full-featured mock MCP client
- **InMemoryTransport** - Zero-latency transport for unit tests
- **Test helpers** - `createTestClient()`, `waitForCondition()`

## API

### MockMcpClient

```typescript
const { client, serverTransport } = MockMcpClient.create();

await client.connect();
await client.listTools();
await client.callTool('toolName', { arg: 'value' });
await client.listResources();
await client.readResource('uri://resource');
await client.listPrompts();
await client.getPrompt('promptName', { arg: 'value' });
await client.close();
```

### InMemoryTransport

```typescript
const { clientTransport, serverTransport } = InMemoryTransport.createPair();
```

## Documentation

**[Read the full documentation](https://v-checha.github.io/mcpkit/)**

- [Testing Guide](https://v-checha.github.io/mcpkit/docs/guides/testing)

## Related Packages

- [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) - Core framework
- [@mcpkit-dev/cli](https://www.npmjs.com/package/@mcpkit-dev/cli) - CLI tool

## License

MIT
