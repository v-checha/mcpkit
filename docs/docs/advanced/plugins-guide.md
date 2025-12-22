---
sidebar_position: 5
---

# Plugins Guide

Plugins are the recommended way to package and share reusable functionality in MCPKit. They can add middleware, hooks, expose APIs, and manage their own lifecycle.

## Quick Start

### Using Built-in Plugins

```typescript
import {
  MCPServer,
  metricsPlugin,
  healthPlugin,
  tracingPlugin,
  createMetricsCollector,
  createHealthChecker,
  createTracer,
  consoleExporter,
} from '@mcpkit-dev/core';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [
    metricsPlugin({ collector: createMetricsCollector({ prefix: 'myapp' }) }),
    healthPlugin({ checker: createHealthChecker() }),
    tracingPlugin({
      tracer: createTracer({ serviceName: 'my-server', exporters: [consoleExporter()] }),
    }),
  ],
})
class MyServer {}
```

### Creating a Simple Plugin

```typescript
import { createPlugin } from '@mcpkit-dev/core';

const loggingPlugin = createPlugin({
  name: 'logging',
  version: '1.0.0',
  description: 'Logs all tool calls',

  // Add middleware
  middleware: async (ctx, next) => {
    console.error(`[${new Date().toISOString()}] ${ctx.method} ${ctx.path}`);
    await next();
  },

  // Add hooks
  hooks: {
    onToolCall: ({ toolName, args }) => {
      console.error(`Tool called: ${toolName}`, args);
    },
    onToolSuccess: ({ toolName, duration }) => {
      console.error(`Tool succeeded: ${toolName} (${duration}ms)`);
    },
    onToolError: ({ toolName, error }) => {
      console.error(`Tool failed: ${toolName}`, error.message);
    },
  },
});

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  plugins: [loggingPlugin],
})
class MyServer {}
```

## Plugin Creation Methods

### createPlugin() - Simple Plugins

For plugins that just need middleware and/or hooks:

```typescript
import { createPlugin } from '@mcpkit-dev/core';

const simplePlugin = createPlugin({
  name: 'simple',
  version: '1.0.0',
  description: 'A simple plugin',

  // Single middleware or array
  middleware: [
    async (ctx, next) => { /* ... */ await next(); },
    async (ctx, next) => { /* ... */ await next(); },
  ],

  // Hooks
  hooks: {
    onServerStart: () => console.error('Server started!'),
    onServerStop: () => console.error('Server stopped!'),
  },

  // Lifecycle callbacks
  onRegister: (ctx) => {
    console.error('Plugin registered');
  },
  onBeforeStart: (ctx) => {
    console.error('About to start');
  },
  onServerStart: (ctx, server) => {
    console.error('Server is running');
  },
  onServerStop: (ctx) => {
    console.error('Server stopped');
  },
});
```

### definePlugin() - Configurable Plugins

For plugins that need configuration and expose an API:

```typescript
import { definePlugin } from '@mcpkit-dev/core';

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

interface CacheApi {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  clear: () => void;
  size: () => number;
}

const cachePlugin = definePlugin<CacheOptions, CacheApi>({
  name: 'cache',
  version: '1.0.0',
  description: 'In-memory caching plugin',

  setup(options, ctx) {
    const ttl = options?.ttl ?? 60000;
    const maxSize = options?.maxSize ?? 1000;
    const cache = new Map<string, { value: unknown; expires: number }>();

    // Cleanup expired entries periodically
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (entry.expires < now) cache.delete(key);
      }
    }, ttl);

    // Register cleanup on stop
    ctx.onStop(() => clearInterval(cleanup));

    // Add middleware
    ctx.useMiddleware(async (ctx, next) => {
      ctx.set('cache', cache);
      await next();
    });

    // Return API
    return {
      get: (key) => {
        const entry = cache.get(key);
        if (!entry || entry.expires < Date.now()) return undefined;
        return entry.value;
      },
      set: (key, value) => {
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          if (firstKey) cache.delete(firstKey);
        }
        cache.set(key, { value, expires: Date.now() + ttl });
      },
      clear: () => cache.clear(),
      size: () => cache.size,
    };
  },
});

// Usage
@MCPServer({
  plugins: [cachePlugin({ ttl: 30000, maxSize: 500 })],
})
class MyServer {}

// Access API (after server starts)
const cache = server.getPluginApi<CacheApi>('cache');
cache.set('key', 'value');
```

### hooksPlugin() - Hooks Only

For plugins that only add hooks:

```typescript
import { hooksPlugin } from '@mcpkit-dev/core';

const auditPlugin = hooksPlugin('audit', {
  onToolCall: async ({ toolName, args, timestamp }) => {
    await auditLog.write({
      event: 'tool_call',
      tool: toolName,
      args,
      timestamp,
    });
  },
  onToolError: async ({ toolName, error, timestamp }) => {
    await auditLog.write({
      event: 'tool_error',
      tool: toolName,
      error: error.message,
      timestamp,
    });
  },
});
```

### middlewarePlugin() - Middleware Only

For plugins that only add middleware:

```typescript
import { middlewarePlugin } from '@mcpkit-dev/core';

const corsPlugin = middlewarePlugin('cors',
  async (ctx, next) => {
    ctx.response.setHeader('Access-Control-Allow-Origin', '*');
    ctx.response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    await next();
  }
);
```

### combinePlugins() - Merge Plugins

Combine multiple plugins into one:

```typescript
import { combinePlugins, createPlugin } from '@mcpkit-dev/core';

const securityBundle = combinePlugins(
  'security-bundle',
  '1.0.0',
  [
    authPlugin({ secret: process.env.JWT_SECRET! }),
    rateLimitPlugin({ maxRequests: 100 }),
    corsPlugin({ origins: ['https://example.com'] }),
  ]
);

@MCPServer({
  plugins: [securityBundle],
})
class MyServer {}
```

## Plugin Context API

The `PluginContext` provides methods for plugins to interact with the server:

```typescript
interface PluginContext {
  // Server info
  serverName: string;
  serverVersion: string;

  // Add middleware
  useMiddleware(middleware: Middleware): void;

  // Add hooks
  useHooks(hooks: Partial<ServerHooks>): void;

  // Plugin state (shared between lifecycle methods)
  state: Map<string, unknown>;

  // Get another plugin's API
  getPlugin<T>(name: string): T | undefined;

  // Register cleanup on stop
  onStop(cleanup: () => void | Promise<void>): void;

  // Logging (uses stderr for stdio compatibility)
  log: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}
```

### Using Plugin State

```typescript
const statefulPlugin = definePlugin<void, { getCounter: () => number }>({
  name: 'stateful',
  version: '1.0.0',

  setup(_, ctx) {
    // Store state
    ctx.state.set('counter', 0);

    ctx.useHooks({
      onToolCall: () => {
        const counter = ctx.state.get('counter') as number;
        ctx.state.set('counter', counter + 1);
      },
    });

    return {
      getCounter: () => ctx.state.get('counter') as number,
    };
  },
});
```

### Accessing Other Plugins

```typescript
const dependentPlugin = definePlugin({
  name: 'dependent',
  version: '1.0.0',
  dependencies: ['cache'], // Declare dependency

  setup(_, ctx) {
    // Get cache plugin's API
    const cache = ctx.getPlugin<CacheApi>('cache');

    if (!cache) {
      throw new Error('Cache plugin is required');
    }

    ctx.useMiddleware(async (ctx, next) => {
      const cacheKey = `response:${ctx.path}`;
      const cached = cache.get(cacheKey);

      if (cached) {
        ctx.set('fromCache', true);
        ctx.set('response', cached);
        return;
      }

      await next();

      const response = ctx.get('response');
      if (response) {
        cache.set(cacheKey, response);
      }
    });
  },
});
```

## Plugin Lifecycle

Plugins go through these phases:

```
1. Register     → onRegister(ctx)         - Plugin is added to server
2. Initialize   → Middleware/hooks added  - Before server starts
3. Before Start → onBeforeStart(ctx)      - Just before transport connects
4. Start        → onServerStart(ctx, srv) - Server is running
5. Stop         → onServerStop(ctx)       - Server is shutting down
```

### Lifecycle Example

```typescript
const lifecyclePlugin = definePlugin({
  name: 'lifecycle-demo',
  version: '1.0.0',

  setup(_, ctx) {
    ctx.log.info('1. Setup called');

    // This runs during initialization
    ctx.useMiddleware(async (ctx, next) => {
      ctx.log.info('Middleware executing');
      await next();
    });

    // Register cleanup
    ctx.onStop(() => {
      ctx.log.info('Cleanup on stop');
    });

    return {};
  },

  onRegister(ctx) {
    ctx.log.info('2. Plugin registered');
  },

  onBeforeStart(ctx) {
    ctx.log.info('3. About to start');
  },

  onServerStart(ctx, server) {
    ctx.log.info('4. Server is running');
    // Can access MCP server instance here
  },

  onServerStop(ctx) {
    ctx.log.info('5. Server stopping');
  },
});
```

## Real-World Plugin Examples

### Database Connection Plugin

```typescript
import { definePlugin } from '@mcpkit-dev/core';
import { Pool } from 'pg';

interface DbOptions {
  connectionString: string;
  maxConnections?: number;
}

interface DbApi {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  transaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

const databasePlugin = definePlugin<DbOptions, DbApi>({
  name: 'database',
  version: '1.0.0',

  async setup(options, ctx) {
    const pool = new Pool({
      connectionString: options.connectionString,
      max: options.maxConnections ?? 10,
    });

    // Test connection
    await pool.query('SELECT 1');
    ctx.log.info('Database connected');

    // Add health check
    ctx.useHooks({
      onServerStart: async () => {
        ctx.log.info('Database pool ready');
      },
    });

    // Cleanup on stop
    ctx.onStop(async () => {
      await pool.end();
      ctx.log.info('Database pool closed');
    });

    // Make pool available in middleware context
    ctx.useMiddleware(async (ctx, next) => {
      ctx.set('db', pool);
      await next();
    });

    return {
      query: async (sql, params) => {
        const result = await pool.query(sql, params);
        return result.rows;
      },
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(client);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    };
  },
});
```

### Request Logging Plugin

```typescript
import { createPlugin } from '@mcpkit-dev/core';
import { appendFile } from 'fs/promises';

interface LogEntry {
  timestamp: string;
  type: 'tool' | 'resource' | 'prompt';
  name: string;
  duration: number;
  status: 'success' | 'error';
  error?: string;
}

const requestLoggerPlugin = createPlugin({
  name: 'request-logger',
  version: '1.0.0',

  hooks: {
    onToolSuccess: async ({ toolName, duration }) => {
      await logEntry({
        timestamp: new Date().toISOString(),
        type: 'tool',
        name: toolName,
        duration,
        status: 'success',
      });
    },
    onToolError: async ({ toolName, duration, error }) => {
      await logEntry({
        timestamp: new Date().toISOString(),
        type: 'tool',
        name: toolName,
        duration,
        status: 'error',
        error: error.message,
      });
    },
    onResourceSuccess: async ({ uri, duration }) => {
      await logEntry({
        timestamp: new Date().toISOString(),
        type: 'resource',
        name: uri,
        duration,
        status: 'success',
      });
    },
  },
});

async function logEntry(entry: LogEntry) {
  await appendFile('requests.log', JSON.stringify(entry) + '\n');
}
```

### Feature Flags Plugin

```typescript
import { definePlugin } from '@mcpkit-dev/core';

interface FeatureFlagsOptions {
  flags: Record<string, boolean>;
  refreshInterval?: number;
}

interface FeatureFlagsApi {
  isEnabled: (flag: string) => boolean;
  setFlag: (flag: string, enabled: boolean) => void;
  getAllFlags: () => Record<string, boolean>;
}

const featureFlagsPlugin = definePlugin<FeatureFlagsOptions, FeatureFlagsApi>({
  name: 'feature-flags',
  version: '1.0.0',

  setup(options, ctx) {
    const flags = new Map(Object.entries(options.flags));

    // Optionally refresh from external source
    if (options.refreshInterval) {
      const interval = setInterval(async () => {
        // Fetch from external source
        const newFlags = await fetchFlags();
        for (const [key, value] of Object.entries(newFlags)) {
          flags.set(key, value);
        }
      }, options.refreshInterval);

      ctx.onStop(() => clearInterval(interval));
    }

    // Make flags available in context
    ctx.useMiddleware(async (ctx, next) => {
      ctx.set('featureFlags', flags);
      await next();
    });

    return {
      isEnabled: (flag) => flags.get(flag) ?? false,
      setFlag: (flag, enabled) => flags.set(flag, enabled),
      getAllFlags: () => Object.fromEntries(flags),
    };
  },
});

// Usage in tool
@Tool({ description: 'New feature' })
async newFeature() {
  const flags = this.context.get('featureFlags') as Map<string, boolean>;
  if (!flags.get('new-feature-enabled')) {
    throw new Error('Feature not available');
  }
  // ...
}
```

## Plugin Registry

For advanced use cases, access the plugin registry directly:

```typescript
import { createPluginRegistry } from '@mcpkit-dev/core';

const registry = createPluginRegistry('my-server', '1.0.0');

// Register plugins
registry.register(loggingPlugin);
registry.register(cachePlugin({ ttl: 30000 }));

// Initialize all plugins
await registry.initializeAll();

// Get collected middleware and hooks
const middleware = registry.getMiddlewares();
const hooks = registry.getHooks();

// Start all plugins
await registry.startAll(mcpServer);

// Get plugin API
const cacheApi = registry.getPluginApi<CacheApi>('cache');

// Stop all plugins
await registry.stopAll();
```

## Best Practices

1. **Name plugins clearly** - Use descriptive names like `database`, `cache`, `auth`
2. **Version your plugins** - Follow semver for breaking changes
3. **Declare dependencies** - Use `dependencies` array for required plugins
4. **Clean up resources** - Use `ctx.onStop()` to release connections, timers
5. **Use ctx.log** - It writes to stderr, safe for stdio transport
6. **Expose minimal API** - Only expose what consumers need
7. **Handle errors gracefully** - Don't let plugin errors crash the server
8. **Document configuration** - TypeScript interfaces make options clear

## See Also

- [Plugins Reference](./plugins.md) - Plugin API reference
- [Middleware Utilities](./middleware-utilities.md) - Advanced middleware
- [Hooks Guide](../guides/hooks.md) - Server lifecycle hooks
