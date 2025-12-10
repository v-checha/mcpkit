# @mcpkit-dev/testing

Testing utilities for MCPKit MCP servers. Provides mock clients, in-memory transports, and helpers for writing comprehensive tests.

## Installation

```bash
npm install -D @mcpkit-dev/testing
```

## Features

- **MockMcpClient** - Full-featured mock MCP client for testing servers
- **InMemoryTransport** - Zero-latency transport for unit tests
- **Test helpers** - Utilities for common testing patterns

## Quick Start

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMcpClient } from '@mcpkit-dev/testing';
import { listen } from '@mcpkit-dev/core';
import { MyServer } from './my-server';

describe('MyServer', () => {
  let client: MockMcpClient;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const { client: mockClient, serverTransport } = MockMcpClient.create();
    client = mockClient;

    const server = await listen(MyServer);
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

  it('should list available tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('greet');
  });

  it('should call a tool', async () => {
    const result = await client.callTool('greet', { name: 'World' });
    expect(result.content[0].text).toBe('Hello, World!');
  });
});
```

## API Reference

### MockMcpClient

A mock MCP client that communicates with servers over in-memory transports.

#### Creating a Client

```typescript
import { MockMcpClient } from '@mcpkit-dev/testing';

// Create with default options
const { client, serverTransport } = MockMcpClient.create();

// Create with custom options
const { client, serverTransport } = MockMcpClient.create({
  name: 'test-client',
  version: '1.0.0',
});
```

#### Methods

##### `connect(): Promise<void>`

Connect the client to the server.

```typescript
await client.connect();
```

##### `close(): Promise<void>`

Close the client connection.

```typescript
await client.close();
```

##### `listTools(): Promise<ListToolsResult>`

List all available tools from the server.

```typescript
const { tools } = await client.listTools();
console.log(tools); // [{ name: 'greet', description: '...' }]
```

##### `callTool(name: string, args?: Record<string, unknown>)`

Call a tool by name with optional arguments.

```typescript
const result = await client.callTool('greet', { name: 'Alice' });
console.log(result.content[0].text); // 'Hello, Alice!'
```

##### `listResources(): Promise<ListResourcesResult>`

List all available resources.

```typescript
const { resources } = await client.listResources();
```

##### `readResource(uri: string): Promise<ReadResourceResult>`

Read a resource by URI.

```typescript
const result = await client.readResource('config://settings');
console.log(result.contents[0].text);
```

##### `listPrompts(): Promise<ListPromptsResult>`

List all available prompts.

```typescript
const { prompts } = await client.listPrompts();
```

##### `getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>`

Get a prompt by name with optional arguments.

```typescript
const result = await client.getPrompt('greeting', { name: 'Bob' });
console.log(result.messages);
```

##### `rawClient: Client`

Access the underlying MCP SDK client for advanced operations.

```typescript
const sdkClient = client.rawClient;
```

### InMemoryTransport

A transport implementation that allows direct communication between client and server without network overhead.

#### Creating a Transport Pair

```typescript
import { InMemoryTransport } from '@mcpkit-dev/testing';

const { clientTransport, serverTransport } = InMemoryTransport.createPair();

// Connect to server
await server.connect(serverTransport);

// Connect client
await client.connect(clientTransport);
```

#### Methods

##### `start(): Promise<void>`

Start the transport and process any queued messages.

##### `send(message: JSONRPCMessage): Promise<void>`

Send a message to the peer transport.

##### `close(): Promise<void>`

Close the transport and its peer.

##### `deliverMessage(message: JSONRPCMessage): void`

Directly deliver a message (for testing edge cases).

### Helper Functions

#### `createTestClient(options?)`

Convenience function to create a mock client.

```typescript
import { createTestClient } from '@mcpkit-dev/testing';

const { client, serverTransport } = createTestClient({
  name: 'my-test-client',
});
```

#### `waitForCondition(condition, options?)`

Wait for a condition to be true with timeout.

```typescript
import { waitForCondition } from '@mcpkit-dev/testing';

// Wait up to 5 seconds for server to be ready
await waitForCondition(() => server.isReady, {
  timeout: 5000,
  interval: 100,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Maximum time to wait (ms) |
| `interval` | `number` | `50` | Check interval (ms) |

#### `createTestServer(ServerClass, listenFn)`

Create a complete test environment with server and connected client.

```typescript
import { createTestServer } from '@mcpkit-dev/testing';
import { listen } from '@mcpkit-dev/core';

const { client, server, instance, cleanup } = await createTestServer(
  MyServer,
  listen
);

// Run tests...
const tools = await client.listTools();

// Clean up
await cleanup();
```

## Testing Patterns

### Testing Tools

```typescript
it('should handle tool errors gracefully', async () => {
  const result = await client.callTool('divide', { a: 10, b: 0 });
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('Cannot divide by zero');
});

it('should validate tool parameters', async () => {
  await expect(
    client.callTool('greet', { invalidParam: 'value' })
  ).rejects.toThrow();
});
```

### Testing Resources

```typescript
it('should read dynamic resources', async () => {
  const result = await client.readResource('users://123');
  const user = JSON.parse(result.contents[0].text);
  expect(user.id).toBe('123');
});

it('should list resource templates', async () => {
  const { resources } = await client.listResources();
  const template = resources.find(r => r.uri.includes('{'));
  expect(template).toBeDefined();
});
```

### Testing Prompts

```typescript
it('should generate prompt with arguments', async () => {
  const result = await client.getPrompt('code-review', {
    language: 'typescript',
    focus: 'security',
  });

  expect(result.messages[0].content.text).toContain('typescript');
  expect(result.messages[0].content.text).toContain('security');
});
```

### Testing with Mocked Dependencies

```typescript
import { vi } from 'vitest';

// Mock external service
vi.mock('./weather-api', () => ({
  getWeather: vi.fn().mockResolvedValue({ temp: 22, condition: 'sunny' }),
}));

it('should use mocked weather data', async () => {
  const result = await client.callTool('getWeather', { city: 'London' });
  expect(result.content[0].text).toContain('22');
});
```

## Integration with Test Frameworks

### Vitest

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('MCP Server Integration', () => {
  // ... setup and tests
});
```

### Jest

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('MCP Server Integration', () => {
  // ... setup and tests
});
```

## Related Packages

- [@mcpkit-dev/core](https://www.npmjs.com/package/@mcpkit-dev/core) - Core decorators and server framework
- [@mcpkit-dev/cli](https://www.npmjs.com/package/@mcpkit-dev/cli) - CLI tool for project scaffolding

## License

MIT
