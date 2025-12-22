---
sidebar_position: 3
---

# Exports Reference

Complete list of all exports from `@mcpkit-dev/core`.

## Decorators

```typescript
import {
  // Class decorators
  MCPServer,

  // Method decorators
  Tool,
  Resource,
  Prompt,
  RequireAuth,
  Traced,
  Monitor,
  Debug,

  // Parameter decorators
  Param,
} from '@mcpkit-dev/core';
```

## Server Functions

```typescript
import {
  // Bootstrap
  bootstrap,
  listen,

  // Composition
  compose,

  // Gateway
  createGateway,
  MCPGateway,
} from '@mcpkit-dev/core';
```

## Middleware

```typescript
import {
  // Built-in middleware
  cors,
  requestLogger,
  errorHandler,

  // Rate limiting
  rateLimiter,
  createRateLimiter,
  slidingWindowLimiter,
  tokenBucketLimiter,

  // Auth helpers
  bearerAuth,
  basicAuth,
  apiKeyAuth,
} from '@mcpkit-dev/core';
```

## Plugins

```typescript
import {
  // Plugin types
  Plugin,

  // Built-in plugins
  metricsPlugin,
  healthPlugin,
  tracingPlugin,
  corsPlugin,
  rateLimitPlugin,
} from '@mcpkit-dev/core';
```

## Observability

```typescript
import {
  // Metrics
  createMetricsCollector,
  MetricsCollector,

  // Tracing
  createTracer,
  setGlobalTracer,
  getGlobalTracer,
  consoleExporter,
  Tracer,
  Span,

  // Health
  HealthCheck,
  HealthCheckResult,
} from '@mcpkit-dev/core';
```

## Authentication

```typescript
import {
  // Auth context
  AuthContext,
  createAuthContext,
  withAuthContext,
  setAuthContext,
  getAuthContext,

  // Errors
  AuthorizationError,
} from '@mcpkit-dev/core';
```

## Types

```typescript
import type {
  // Server types
  ListenOptions,
  BootstrappedServer,
  ServerHooks,

  // Middleware types
  MiddlewareContext,
  Middleware,
  NextFunction,

  // Plugin types
  PluginContext,

  // Gateway types
  GatewayOptions,
  UpstreamServer,
  LoadBalanceStrategy,

  // Observability types
  SpanKind,
  SpanStatusCode,
  SpanAttributes,
  SpanEvent,
} from '@mcpkit-dev/core';
```

## Testing Utilities

```typescript
import {
  createTestClient,
  createMockServer,
  TestClient,
} from '@mcpkit-dev/testing';
```

## CLI

```bash
# Create new project
npx @mcpkit-dev/cli create my-server

# Generate components
npx @mcpkit-dev/cli generate tool my-tool
npx @mcpkit-dev/cli generate resource my-resource
npx @mcpkit-dev/cli generate prompt my-prompt
```
