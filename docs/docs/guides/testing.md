---
sidebar_position: 6
---

# Testing

MCPKit provides utilities for testing your MCP servers.

## Installation

```bash
npm install -D @mcpkit-dev/testing vitest
```

## Mock Client

The `MockMcpClient` provides a simple way to test your servers:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMcpClient } from '@mcpkit-dev/testing';
import { bootstrapServer, MetadataStorage } from '@mcpkit-dev/core';
import { MyServer } from './server';

describe('MyServer', () => {
  let client: MockMcpClient;
  let server: Awaited<ReturnType<typeof bootstrapServer>>;

  beforeEach(async () => {
    const { client: mockClient, serverTransport } = MockMcpClient.create();
    client = mockClient;

    const instance = new MyServer();
    const options = MetadataStorage.getServerOptions(MyServer);
    server = await bootstrapServer(instance, options!);

    await server.server.connect(serverTransport);
    await client.connect();
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('should call a tool', async () => {
    const result = await client.callTool('greet', { name: 'World' });

    expect(result.content[0].text).toBe('Hello, World!');
  });

  it('should read a resource', async () => {
    const result = await client.readResource('config://settings');

    expect(result.contents[0].text).toContain('theme');
  });

  it('should get a prompt', async () => {
    const result = await client.getPrompt('writeEmail', {
      recipient: 'john@example.com',
    });

    expect(result.messages).toHaveLength(1);
  });
});
```

## In-Memory Transport

For lower-level testing:

```typescript
import { InMemoryTransport } from '@mcpkit-dev/testing';

const { clientTransport, serverTransport } = InMemoryTransport.createPair();

// Use transports directly
await server.connect(serverTransport);
await client.connect(clientTransport);
```

## Testing with Auth Context

```typescript
import { withAuthContext, createAuthContext } from '@mcpkit-dev/core';

it('should allow admin access', async () => {
  const result = await withAuthContext(
    createAuthContext({ userId: '123' }, { roles: ['admin'] }),
    () => client.callTool('adminOnlyTool', {}),
  );

  expect(result.content[0].text).toBe('Success');
});
```
