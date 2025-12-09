/**
 * MCPKit - Developer-friendly toolkit for building MCP servers
 *
 * @example
 * ```typescript
 * import 'reflect-metadata';
 * import { MCPServer, Tool, Param } from '@mcpkit/core';
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

export {
  Param,
  type ParamDecoratorOptions,
} from './decorators/param.js';
export {
  Prompt,
  type PromptDecoratorOptions,
} from './decorators/prompt.js';
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
  type ParamMetadata,
  type PromptMetadata,
  type ResourceMetadata,
  type ServerOptionsMetadata,
  type ToolMetadata,
} from './metadata/index.js';
// Schema utilities (advanced usage)
export {
  buildSchemaFromParams,
  buildToolInputSchema,
  inferSchemaFromType,
  zodShapeToJsonSchema,
} from './schema/index.js';
// Server bootstrap (advanced usage)
export {
  type BootstrappedServer,
  bootstrapServer,
} from './server/index.js';
// Transport (advanced usage)
export {
  createStdioTransport,
  StdioTransport,
  type TransportKind,
} from './transport/index.js';
// Types
export type {
  ImageContent,
  ListenOptions,
  MCPServerInstance,
  PromptMessage,
  PromptMessageContent,
  PromptResult,
  PromptRole,
  ResourceContent,
  ResourceContentItem,
  ResourceResult,
  TextContent,
  ToolResult,
  ToolResultContent,
  TransportType,
} from './types/index.js';
