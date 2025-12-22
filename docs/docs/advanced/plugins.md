---
sidebar_position: 4
---

# Plugin System

Create reusable plugins to extend MCPKit functionality.

## Creating a Plugin

```typescript
import { createPlugin, type PluginContext } from '@mcpkit-dev/core';

const myPlugin = createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'A custom plugin',

  onRegister: (ctx: PluginContext) => {
    console.log('Plugin registered');
  },
  onServerStart: async () => {
    console.log('Server starting');
  },
  onServerStop: async () => {
    console.log('Server stopping');
  },

  hooks: {
    onToolCall: ({ toolName }) => {
      console.log(`Tool called: ${toolName}`);
    },
  },

  middleware: [loggingMiddleware],

  api: {
    customMethod: () => 'hello',
  },
});
```

## Built-in Plugins

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, metricsPlugin, healthPlugin, tracingPlugin, consoleExporter } from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    metricsPlugin({ prefix: 'myapp_' }),
    healthPlugin({ checks: [{ name: 'db', check: async () => ({ status: 'healthy' }) }] }),
    tracingPlugin({ serviceName: 'my-server', exporters: [consoleExporter()] }),
  ],
})
class MyServer {}

const server = createServer(MyServer);
await server.listen();
```
