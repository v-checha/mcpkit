---
sidebar_position: 4
---

# Debugging

The `@Debug` decorator provides detailed logging for your MCP server tools, resources, and prompts. This is especially useful when developing locally or troubleshooting issues with Claude Desktop.

## Basic Usage

```typescript
import { createServer, MCPServer, Tool, Param, Debug } from '@mcpkit-dev/core';

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add two numbers' })
  @Debug()
  async add(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    return a + b;
  }
}

const server = createServer(MyServer);
server.listen();
```

By default, `@Debug` logs to `stderr` (which appears in Claude Desktop's MCP logs). Output looks like:

```
[2024-12-22T14:30:00.000Z] [DEBUG] → tool:add { type: 'tool', name: 'add', args: [5, 3] }
[2024-12-22T14:30:00.005Z] [DEBUG] ← tool:add ✓ { type: 'tool', name: 'add', duration: '5ms', result: 8 }
```

## Global Configuration

Configure debug settings globally with `configureDebug`:

```typescript
import { configureDebug } from '@mcpkit-dev/core';

configureDebug({
  enabled: true,           // Enable/disable all @Debug decorators
  level: 'debug',          // Minimum log level: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  logArgs: true,           // Log input arguments
  logResult: true,         // Log return values
  logDuration: true,       // Log execution time
});
```

Debug is automatically enabled when `NODE_ENV=development` or `MCPKIT_DEBUG=true`.

## Debug Options

The `@Debug` decorator accepts these options:

```typescript
@Debug({
  enabled: true,           // Override global enabled setting
  level: 'debug',          // Minimum log level
  logArgs: true,           // Log input arguments
  logResult: true,         // Log return values
  logDuration: true,       // Log execution time
  label: 'custom-label',   // Custom label for log output
  logger: customLogger,    // Custom logger implementation
  sanitize: (key, value) => value,  // Sanitize sensitive data
})
```

## Sanitizing Sensitive Data

By default, fields containing `password`, `token`, `secret`, `apiKey`, `api_key`, or `authorization` are redacted. You can customize this:

```typescript
@Tool({ description: 'Login user' })
@Debug({
  sanitize: (key, value) => {
    if (key === 'password' || key === 'ssn') {
      return '[REDACTED]';
    }
    return value;
  },
})
async login(
  @Param({ name: 'username' }) username: string,
  @Param({ name: 'password' }) password: string
): Promise<string> {
  // Password will be logged as [REDACTED]
  return 'token';
}
```

## Writing Logs to a File

When debugging MCP servers running in Claude Desktop, it's helpful to write logs to a file. Here's a complete example:

```typescript
import 'reflect-metadata';
import {
  createServer,
  MCPServer,
  Tool,
  Param,
  Debug,
  configureDebug,
  type DebugLogger,
  type DebugLevel,
} from '@mcpkit-dev/core';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory where this script is located (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs in project root (one level up from dist/)
const logDir = join(__dirname, '..', 'logs');
const logFile = join(logDir, 'mcp-server.log');

// Safely create log directory at startup
if (!existsSync(logDir)) {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Silently fail - we'll handle errors when writing
  }
}

// Create a file logger
const fileLogger: DebugLogger = {
  log(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logLine = JSON.stringify({
      timestamp,
      level,
      message,
      ...data,
    }) + '\n';

    try {
      appendFileSync(logFile, logLine);
    } catch {
      // Silent fail - don't crash the server for logging
    }
  },
};

// Configure globally
configureDebug({
  enabled: true,
  logger: fileLogger,
});

@MCPServer({ name: 'my-server', version: '1.0.0' })
class MyServer {
  @Tool({ description: 'Add two numbers together' })
  @Debug()
  async add(
    @Param({ name: 'a', description: 'First number' }) a: number,
    @Param({ name: 'b', description: 'Second number' }) b: number
  ): Promise<number> {
    return a + b;
  }

  @Tool({ description: 'Divide two numbers' })
  @Debug({ level: 'info' })
  async divide(
    @Param({ name: 'a' }) a: number,
    @Param({ name: 'b' }) b: number
  ): Promise<number> {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

const server = createServer(MyServer);

server.listen().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

After running your server and calling tools, check `./logs/mcp-server.log`:

```json
{"timestamp":"2024-12-22T14:30:00.000Z","level":"debug","message":"→ tool:add","type":"tool","name":"add","args":[5,3]}
{"timestamp":"2024-12-22T14:30:00.005Z","level":"debug","message":"← tool:add ✓","type":"tool","name":"add","duration":"5ms","result":8}
{"timestamp":"2024-12-22T14:30:01.000Z","level":"debug","message":"→ tool:divide","type":"tool","name":"divide","args":[10,0]}
{"timestamp":"2024-12-22T14:30:01.002Z","level":"error","message":"← tool:divide ✗","type":"tool","name":"divide","error":"Division by zero","duration":"2ms"}
```

## Rotating File Logger

For production or long-running servers, implement log rotation:

```typescript
import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import type { DebugLogger, DebugLevel } from '@mcpkit-dev/core';

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

function createRotatingFileLogger(logDir: string, filename: string): DebugLogger {
  const logFile = join(logDir, filename);

  // Ensure directory exists
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  function rotateIfNeeded(): void {
    try {
      const stats = statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        renameSync(logFile, join(logDir, `${filename}.${timestamp}`));
      }
    } catch {
      // File doesn't exist yet, no rotation needed
    }
  }

  return {
    log(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
      const timestamp = new Date().toISOString();
      const logLine = JSON.stringify({ timestamp, level, message, ...data }) + '\n';

      try {
        rotateIfNeeded();
        appendFileSync(logFile, logLine);
      } catch {
        // Silent fail
      }
    },
  };
}

// Usage
configureDebug({
  enabled: true,
  logger: createRotatingFileLogger('./logs', 'mcp-server.log'),
});
```

## Debugging in Claude Desktop

### Finding MCP Logs

Claude Desktop logs MCP server output to:

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Windows:**
```
%APPDATA%\Claude\logs\mcp*.log
```

### Common Issues

1. **Server disconnects immediately**
   - Run your server directly first: `node dist/index.js`
   - Check for missing `reflect-metadata` import
   - Verify `experimentalDecorators` and `emitDecoratorMetadata` in tsconfig

2. **Tools not appearing**
   - Tools don't show in UI - they're available to Claude automatically
   - Ask Claude to use your tool: "Use the add tool to calculate 5 + 3"
   - Check logs to verify tools are registered

3. **Path issues with file logging**
   - Use `import.meta.url` and `fileURLToPath` for ESM modules
   - Use absolute paths based on `__dirname`
   - Create log directory at startup, not in the logger

## Combining with Hooks

For more comprehensive logging, combine `@Debug` with server hooks:

```typescript
@MCPServer({
  name: 'my-server',
  version: '1.0.0',
  hooks: {
    onServerStart: () => {
      console.error('[my-server] Server started');
    },
    onServerStop: () => {
      console.error('[my-server] Server stopped');
    },
    onToolCall: ({ toolName, args }) => {
      console.error(`[my-server] Tool "${toolName}" called with:`, args);
    },
    onToolError: ({ toolName, error }) => {
      console.error(`[my-server] Tool "${toolName}" failed:`, error.message);
    },
  },
})
class MyServer {
  @Tool({ description: 'My tool' })
  @Debug()
  async myTool(): Promise<string> {
    return 'done';
  }
}
```

## Using with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a visual debugging tool:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web UI where you can:
- See all registered tools, resources, and prompts
- Test tools with custom inputs
- View request/response payloads
- Debug without Claude Desktop
