/**
 * MCPKit - Developer-friendly toolkit for building MCP servers
 *
 * @example
 * ```typescript
 * import 'reflect-metadata';
 * import { MCPServer, Tool, Param } from '@mcpkit-dev/core';
 *
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0'
 * })
 * class MyServer {
 *   @Tool({ description: 'Greet someone' })
 *   async greet(@Param({ name: 'name' }) name: string) {
 *     return `Hello, ${name}!`;
 *   }
 * }
 *
 * const server = new MyServer();
 * await server.listen();
 * ```
 *
 * @packageDocumentation
 */

// Re-export reflect-metadata for convenience
import 'reflect-metadata';

export type {
  DebugContext,
  DebugLevel,
  DebugLogger,
  DebugOptions,
} from './decorators/debug.js';
// Debug decorator
export {
  configureDebug,
  Debug,
  getDebugConfig,
  getDebugOptions,
  isDebugEnabled,
} from './decorators/debug.js';

// Documentation decorators
export {
  Documented,
  type DocumentedExample,
  type DocumentedOptions,
  getDocumentedOptions,
  getServerDocumentedOptions,
  ServerDocumented,
  type ServerDocumentedOptions,
} from './decorators/documented.js';
export { Monitor } from './decorators/monitor.js';
export {
  Param,
  type ParamDecoratorOptions,
} from './decorators/param.js';
export {
  Prompt,
  type PromptDecoratorOptions,
} from './decorators/prompt.js';
// RequireAuth decorator
export {
  AUTH_STATE_KEY,
  AuthorizationError,
  createAuthContext,
  getAuthContext,
  getRequireAuthMetadata,
  getRequireAuthOptions,
  isAuthRequired,
  RequireAuth,
  type RequireAuthOptions,
  setAuthContext,
  unauthenticatedContext,
  withAuthContext,
} from './decorators/require-auth.js';
export {
  Resource,
  type ResourceDecoratorOptions,
} from './decorators/resource.js';
// Decorators
export {
  MCPServer,
  type MCPServerDecoratorOptions,
} from './decorators/server.js';
export {
  Tool,
  type ToolAnnotations,
  type ToolDecoratorOptions,
} from './decorators/tool.js';
// Traced decorator
export {
  getGlobalTracer,
  getTracedMetadata,
  getTracedOptions,
  isTraced,
  setGlobalTracer,
  Traced,
  type TracedOptions,
  traced,
  withTrace,
} from './decorators/traced.js';
export type {
  DocFormat,
  DocGeneratorOptions,
  DocGeneratorResult,
  ParamDoc,
  PromptDoc,
  ResourceDoc,
  ServerDoc,
  ToolDoc,
} from './docs/index.js';
// Documentation generator
export {
  DocGenerator,
  extractDocs,
  extractServerDoc,
  extractServerDocFromInstance,
  formatJson,
  formatMarkdown,
  formatOpenAPI,
  generateDocs,
} from './docs/index.js';
// Errors
export {
  BootstrapError,
  DecoratorError,
  MCPKitError,
  SchemaError,
  ToolExecutionError,
  TransportError,
} from './errors/index.js';
// Metadata (advanced usage)
export {
  METADATA_KEYS,
  type MetadataKey,
  MetadataStorage,
  type MonitorMetadata,
  type ParamMetadata,
  type PromptMetadata,
  type ResourceMetadata,
  type ServerOptionsMetadata,
  type ToolMetadata,
} from './metadata/index.js';
export type {
  ApiKeyAuthOptions,
  AuthContext,
  BearerAuthOptions,
  BearerValidationResult,
  // Chain types
  CacheOptions,
  ConditionalOptions,
  ErrorHandlerOptions,
  JwtAuthOptions,
  JwtPayload,
  Middleware,
  MiddlewareContext,
  MiddlewareGroupOptions,
  MiddlewareHooksOptions,
  MiddlewareInput,
  MiddlewareOptions,
  NamedMiddleware,
  NextFunction,
  RateLimitInfo,
  RateLimitOptions,
  RateLimitStore,
  RetryOptions,
  TimeoutOptions,
  TraceSpan,
  TracingOptions,
} from './middleware/index.js';
// Middleware (HTTP transports)
export {
  // Tracing
  advancedTracing,
  // Auth
  apiKeyAuth,
  bearerAuth,
  CORRELATION_ID_KEY,
  // Pipeline
  compose,
  // Chain enhancements
  conditional,
  createJwt,
  createMiddlewareGroup,
  createPipeline,
  getCorrelationId,
  getTraceContext,
  isNamedMiddleware,
  jwtAuth,
  // Rate limiting
  MemoryRateLimitStore,
  MiddlewarePipeline,
  parallelMiddleware,
  rateLimit,
  // Types
  STATE_KEYS,
  selectMiddleware,
  TimeoutError,
  TRACE_CONTEXT_KEY,
  TraceContext,
  tracing,
  withCache,
  withErrorHandler,
  withHooks,
  withRetry,
  withTimeout,
} from './middleware/index.js';
export type {
  // Metrics types
  Counter,
  Gauge,
  // Health types
  HealthCheckOptions,
  HealthEndpointOptions,
  HealthPluginOptions,
  HealthResponse,
  Histogram,
  HistogramOptions,
  Metric,
  MetricLabels,
  MetricsCollectorOptions,
  MetricType,
  // Tracing types
  Span,
  SpanAttributes,
  SpanAttributeValue,
  SpanEvent,
  SpanExporter,
  SpanKind,
  SpanLink,
  SpanStatusCode,
  StartSpanOptions,
  Tracer,
  TracerOptions,
} from './observability/index.js';
// Observability (metrics, health, tracing)
export {
  // Tracing
  consoleExporter,
  // Health
  createHealthChecker,
  createHealthHandler,
  // Metrics
  createMetricsCollector,
  createTracer,
  HealthChecker,
  healthMiddleware,
  healthPlugin,
  MetricsCollector,
  memoryExporter,
  metricsPlugin,
  TracerImpl,
  tracingPlugin,
} from './observability/index.js';
export type {
  MCPKitPlugin,
  PluginApi,
  PluginContext,
  PluginFactory,
  PluginInput,
  PluginLifecycle,
  PluginMeta,
  PluginRegistry,
  ResolvedPlugin,
  SimplePluginOptions,
} from './plugins/index.js';
// Plugin system
export {
  combinePlugins,
  createPlugin,
  createPluginRegistry,
  definePlugin,
  hooksPlugin,
  middlewarePlugin,
  PluginRegistryImpl,
} from './plugins/index.js';
// Schema utilities (advanced usage)
export {
  buildSchemaFromParams,
  buildToolInputSchema,
  inferSchemaFromType,
  zodShapeToJsonSchema,
} from './schema/index.js';
export type {
  // Gateway
  CircuitBreakerConfig,
  CircuitState,
  // Composition
  ComposedServerClass,
  ComposedServerInstance,
  ComposedServerMetadata,
  ComposeOptions,
  Gateway,
  GatewayOptions,
  // Inspection
  HealthCheckFn,
  HealthCheckResult,
  HealthStatus,
  InspectionOptions,
  InspectionResult,
  LoadBalancingStrategy,
  ServerStats,
  UpstreamHealth,
  UpstreamServer,
} from './server/index.js';
// Server bootstrap (advanced usage)
export {
  type BootstrappedServer,
  bootstrapServer,
  // Composition
  combinePrompts,
  combineResources,
  combineTools,
  composeServers,
  createComposedServer,
  // Gateway
  createGateway,
  // Inspection
  createInspector,
  MCPGateway,
  ServerInspector,
} from './server/index.js';
// Transport (advanced usage)
export {
  createSseTransport,
  createStdioTransport,
  createStreamableHttpTransport,
  SseTransport,
  type SseTransportOptions,
  StdioTransport,
  StreamableHttpTransport,
  type StreamableHttpTransportOptions,
  type TransportKind,
} from './transport/index.js';

// Types
export type {
  ImageContent,
  ListenOptions,
  MCPServerInstance,
  // Hook types
  MonitorLogger,
  MonitorOptions,
  PromptErrorContext,
  PromptGetContext,
  PromptMessage,
  PromptMessageContent,
  PromptResult,
  PromptRole,
  PromptSuccessContext,
  ResourceContent,
  ResourceContentItem,
  ResourceErrorContext,
  ResourceReadContext,
  ResourceResult,
  ResourceSuccessContext,
  ServerHooks,
  TextContent,
  ToolCallContext,
  ToolErrorContext,
  ToolResult,
  ToolResultContent,
  ToolSuccessContext,
  TransportType,
} from './types/index.js';
