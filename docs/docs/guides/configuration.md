---
sidebar_position: 5
---

# Configuration & Arguments

Learn how to configure your MCP server using command-line arguments and environment variables from the client configuration.

## How Configuration Works

When you configure an MCP server in Claude Desktop (or other MCP clients), you can pass arguments and environment variables:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.js", "--api-key", "secret123", "--debug"],
      "env": {
        "DATABASE_URL": "postgresql://localhost/mydb",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Your server receives:
- Command-line arguments via `process.argv`
- Environment variables via `process.env`

## Parsing Command-Line Arguments

### Simple Manual Parsing

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

function parseArgs() {
  const args = process.argv.slice(2);
  const config: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        config[key] = nextArg;
        i++;
      } else {
        config[key] = true;
      }
    }
  }
  return config;
}

const config = parseArgs();

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  private apiKey = config['api-key'] as string;

  @Tool({ description: 'Call external API' })
  async callApi(@Param({ name: 'query' }) query: string) {
    return `Called API with key: ${this.apiKey ? '***' : 'none'}`;
  }
}

const server = createServer(MyServer);
await server.listen();
```

### Using Constructor Parameters

For better encapsulation, pass configuration through the constructor:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

interface ServerConfig {
  apiKey: string;
  debug: boolean;
  baseUrl?: string;
}

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  constructor(private config: ServerConfig) {
    if (config.debug) {
      console.error('[DEBUG] Server initialized with config');
    }
  }

  @Tool({ description: 'Fetch data from API' })
  async fetchData(@Param({ name: 'endpoint' }) endpoint: string) {
    const url = `${this.config.baseUrl ?? 'https://api.example.com'}/${endpoint}`;
    // Use this.config.apiKey for authentication
    return { url, authenticated: !!this.config.apiKey };
  }

  @Tool({ description: 'Get current config (redacted)' })
  async getConfig() {
    return {
      apiKey: this.config.apiKey ? '***' : 'not set',
      debug: this.config.debug,
      baseUrl: this.config.baseUrl ?? 'default',
    };
  }
}

// Parse arguments
const args = process.argv.slice(2);
const config: ServerConfig = {
  apiKey: '',
  debug: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--api-key':
      config.apiKey = args[++i];
      break;
    case '--debug':
      config.debug = true;
      break;
    case '--base-url':
      config.baseUrl = args[++i];
      break;
  }
}

// Pass config to createServer
const server = createServer(MyServer, config);
await server.listen();
```

### Using Commander.js

For more complex argument parsing, use a library like Commander:

```bash
npm install commander
```

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';
import { program } from 'commander';

program
  .option('--api-key <key>', 'API key for external service')
  .option('--debug', 'Enable debug mode', false)
  .option('--base-url <url>', 'Base URL for API', 'https://api.example.com')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '5000')
  .parse();

const options = program.opts();

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Check server configuration' })
  async checkConfig() {
    return {
      debug: options.debug,
      baseUrl: options.baseUrl,
      timeout: parseInt(options.timeout),
      hasApiKey: !!options.apiKey,
    };
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Environment Variables

Environment variables are often preferred for secrets since they don't appear in process listings.

### Client Configuration

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "secret123",
        "DATABASE_URL": "postgresql://localhost/mydb",
        "DEBUG": "true",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Server Implementation

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';

interface Config {
  apiKey: string;
  databaseUrl: string;
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function loadConfig(): Config {
  return {
    apiKey: process.env.API_KEY ?? '',
    databaseUrl: process.env.DATABASE_URL ?? '',
    debug: process.env.DEBUG === 'true',
    logLevel: (process.env.LOG_LEVEL as Config['logLevel']) ?? 'info',
  };
}

const config = loadConfig();

// Validate required config
if (!config.apiKey) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Query the database' })
  async queryDatabase(@Param({ name: 'query' }) query: string) {
    if (config.debug) {
      console.error(`[DEBUG] Executing query: ${query}`);
    }
    // Use config.databaseUrl to connect
    return { success: true, query };
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Combining Arguments and Environment Variables

A common pattern is to use environment variables as defaults that can be overridden by command-line arguments:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool } from '@mcpkit-dev/core';

interface Config {
  apiKey: string;
  baseUrl: string;
  debug: boolean;
  maxRetries: number;
}

function loadConfig(): Config {
  const args = process.argv.slice(2);

  // Start with environment variables as defaults
  const config: Config = {
    apiKey: process.env.API_KEY ?? '',
    baseUrl: process.env.BASE_URL ?? 'https://api.example.com',
    debug: process.env.DEBUG === 'true',
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3'),
  };

  // Override with command-line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--base-url':
        config.baseUrl = args[++i];
        break;
      case '--debug':
        config.debug = true;
        break;
      case '--max-retries':
        config.maxRetries = parseInt(args[++i]);
        break;
    }
  }

  return config;
}

const config = loadConfig();

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Show current configuration' })
  async showConfig() {
    return {
      baseUrl: config.baseUrl,
      debug: config.debug,
      maxRetries: config.maxRetries,
      hasApiKey: !!config.apiKey,
    };
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Configuration with Validation

Use Zod to validate your configuration:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool } from '@mcpkit-dev/core';
import { z } from 'zod';

const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'API_KEY is required'),
  baseUrl: z.string().url().default('https://api.example.com'),
  debug: z.boolean().default(false),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(30000).default(5000),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const raw = {
    apiKey: process.env.API_KEY,
    baseUrl: process.env.BASE_URL,
    debug: process.env.DEBUG === 'true',
    maxRetries: process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : undefined,
    timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : undefined,
  };

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    console.error('Configuration error:');
    result.error.issues.forEach(issue => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

const config = loadConfig();

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Get API status' })
  async getStatus() {
    return { configured: true, baseUrl: config.baseUrl };
  }
}

const server = createServer(MyServer);
await server.listen();
```

## Security Best Practices

1. **Use environment variables for secrets** - They don't appear in `ps` output
2. **Never log sensitive values** - Redact API keys in logs
3. **Validate configuration on startup** - Fail fast with clear error messages
4. **Use default values wisely** - Don't default sensitive values
5. **Document required configuration** - Help users configure correctly

```typescript
// Good: Validate and fail fast
if (!config.apiKey) {
  console.error('ERROR: API_KEY is required. Set it in your MCP client config:');
  console.error('  "env": { "API_KEY": "your-key-here" }');
  process.exit(1);
}

// Good: Redact in logs
console.error(`Connecting with API key: ${config.apiKey.slice(0, 4)}***`);

// Bad: Never do this
console.error(`API key: ${config.apiKey}`);
```
