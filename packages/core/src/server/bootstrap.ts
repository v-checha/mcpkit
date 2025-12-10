import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import { BootstrapError } from '../errors/index.js';
import {
  MetadataStorage,
  type ParamMetadata,
  type PromptMetadata,
  type ResourceMetadata,
  type ServerOptionsMetadata,
  type ToolMetadata,
} from '../metadata/index.js';
import { buildSchemaFromParams } from '../schema/index.js';
import { SseTransport, StreamableHttpTransport } from '../transport/index.js';
import type {
  MonitorOptions,
  PromptErrorContext,
  PromptGetContext,
  PromptSuccessContext,
  ResourceErrorContext,
  ResourceReadContext,
  ResourceSuccessContext,
  ServerHooks,
  ToolCallContext,
  ToolErrorContext,
  ToolSuccessContext,
} from '../types/hooks.js';
import type { ListenOptions } from '../types/index.js';

/**
 * Helper to invoke a hook with proper await handling
 */
async function invokeHook<T>(
  hooks: ServerHooks | undefined,
  hookFn: ((ctx: T) => void | Promise<void>) | undefined,
  context: T,
): Promise<void> {
  if (!hookFn) return;
  const promise = hookFn(context);
  if (hooks?.awaitHooks !== false && promise) {
    await promise;
  }
}

/**
 * Apply @Monitor decorator logging if configured
 */
function applyMonitorLogging(
  monitorOpts: MonitorOptions | undefined,
  type: 'call' | 'success' | 'error',
  data: {
    name: string;
    args?: Record<string, unknown>;
    result?: unknown;
    duration?: number;
    error?: Error;
  },
): void {
  if (!monitorOpts) return;

  const logger = monitorOpts.logger ?? console.log.bind(console);
  const errorLogger = monitorOpts.errorLogger ?? console.error.bind(console);

  if (type === 'call' && monitorOpts.logArgs) {
    logger(`[Monitor] ${data.name} called`, { args: data.args });
  }

  if (type === 'success') {
    const logData: Record<string, unknown> = {};
    if (monitorOpts.logResult) {
      logData.result = data.result;
    }
    if (monitorOpts.logDuration && data.duration !== undefined) {
      logData.duration = `${data.duration}ms`;
    }
    if (Object.keys(logData).length > 0) {
      logger(`[Monitor] ${data.name} completed`, logData);
    }
  }

  if (type === 'error' && monitorOpts.logErrors) {
    const logData: Record<string, unknown> = { error: data.error?.message };
    if (monitorOpts.logDuration && data.duration !== undefined) {
      logData.duration = `${data.duration}ms`;
    }
    errorLogger(`[Monitor] ${data.name} failed`, logData);
  }
}

/**
 * Result of bootstrapping a server
 */
export interface BootstrappedServer {
  /** The underlying MCP server instance */
  server: McpServer;
  /** The transport being used */
  transport: Transport;
  /** Connect and start the server */
  connect: () => Promise<void>;
  /** Close the server */
  close: () => Promise<void>;
}

/**
 * Extract URI template parameters from a URI template string
 * e.g., 'weather://cities/{city}/forecast' -> ['city']
 */
function extractUriParams(uriTemplate: string): string[] {
  const matches = uriTemplate.matchAll(/\{([^}]+)\}/g);
  return Array.from(matches, (m) => m[1]).filter((p): p is string => p !== undefined);
}

/**
 * Match a URI against a template and extract parameter values
 */
function matchUriTemplate(template: string, uri: string): Record<string, string> | null {
  // Convert template to regex
  const regexPattern = template.replace(/\{([^}]+)\}/g, '(?<$1>[^/]+)');
  const regex = new RegExp(`^${regexPattern}$`);
  const match = uri.match(regex);

  if (!match?.groups) {
    return null;
  }

  return match.groups;
}

/**
 * Format tool result to MCP-compatible format
 */
function formatResult(result: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
} {
  if (result === null || result === undefined) {
    return { content: [{ type: 'text', text: '' }] };
  }

  if (typeof result === 'string') {
    return { content: [{ type: 'text', text: result }] };
  }

  if (typeof result === 'number' || typeof result === 'boolean') {
    return { content: [{ type: 'text', text: String(result) }] };
  }

  // Objects and arrays - serialize as JSON
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

/**
 * Format error result
 */
function formatError(error: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Bootstrap an MCP server from a decorated class instance
 */
export async function bootstrapServer(
  instance: object,
  options: ServerOptionsMetadata,
  listenOptions: ListenOptions = {},
): Promise<BootstrappedServer> {
  const prototype = Object.getPrototypeOf(instance);

  // Determine capabilities based on what's registered
  const tools = MetadataStorage.getToolsMetadata(prototype);
  const resources = MetadataStorage.getResourcesMetadata(prototype);
  const prompts = MetadataStorage.getPromptsMetadata(prototype);

  const hasTools = tools.length > 0 && options.capabilities?.tools !== false;
  const hasResources = resources.length > 0 && options.capabilities?.resources !== false;
  const hasPrompts = prompts.length > 0 && options.capabilities?.prompts !== false;

  // Create MCP server instance
  const server = new McpServer(
    {
      name: options.name,
      version: options.version,
    },
    {
      capabilities: {
        ...(hasTools && { tools: {} }),
        ...(hasResources && { resources: {} }),
        ...(hasPrompts && { prompts: {} }),
      },
    },
  );

  // Get hooks from options
  const hooks = options.hooks;

  // Register tools
  if (hasTools) {
    registerTools(server, instance, prototype, tools, hooks);
  }

  // Register resources
  if (hasResources) {
    registerResources(server, instance, resources, hooks);
  }

  // Register prompts
  if (hasPrompts) {
    registerPrompts(server, instance, prototype, prompts, hooks);
  }

  // Create transport
  const transport = createTransport(listenOptions);

  return {
    server,
    transport,
    connect: async () => {
      await server.connect(transport);
    },
    close: async () => {
      await server.close();
    },
  };
}

/**
 * Register all tools with the MCP server
 */
function registerTools(
  server: McpServer,
  instance: object,
  prototype: object,
  tools: ToolMetadata[],
  hooks?: ServerHooks,
): void {
  for (const toolMeta of tools) {
    const toolName = toolMeta.name ?? String(toolMeta.propertyKey);
    const method = (instance as Record<string | symbol, unknown>)[toolMeta.propertyKey] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    if (typeof method !== 'function') {
      throw new BootstrapError(
        `Tool "${toolName}" references property "${String(toolMeta.propertyKey)}" which is not a function`,
      );
    }

    // Get parameter metadata
    const params = MetadataStorage.getParamsMetadata(prototype, toolMeta.propertyKey);

    // Get monitor options if @Monitor decorator is applied (only works if hooks are configured)
    const monitorOpts = hooks
      ? MetadataStorage.getMonitorOptions(prototype, toolMeta.propertyKey)
      : undefined;

    // Build input schema
    let inputSchema: Record<string, z.ZodTypeAny> | undefined;

    if (toolMeta.schema) {
      // Explicit schema provided
      if (toolMeta.schema instanceof z.ZodObject) {
        inputSchema = toolMeta.schema.shape;
      }
    } else if (params.length > 0) {
      // Build from @Param decorators
      inputSchema = buildSchemaFromParams(params) as Record<string, z.ZodTypeAny>;
    }

    // Create wrapped handler with hooks
    const createHandler =
      (hasParams: boolean) =>
      async (args: Record<string, unknown> = {}) => {
        const startTime = Date.now();
        const timestamp = startTime;

        // Build context for hooks
        const callContext: ToolCallContext = { toolName, args, timestamp };

        // Call onToolCall hook
        await invokeHook(hooks, hooks?.onToolCall, callContext);

        // Apply @Monitor logging for call
        applyMonitorLogging(monitorOpts, 'call', { name: toolName, args });

        try {
          let result: unknown;

          if (!hasParams) {
            result = await method.call(instance);
          } else if (toolMeta.schema) {
            // Explicit schema - pass args object directly
            result = await method.call(instance, args);
          } else {
            // @Param decorators - extract args in order
            const sortedParams = [...params]
              .filter((p): p is ParamMetadata => p !== undefined)
              .sort((a, b) => a.index - b.index);
            const orderedArgs = sortedParams.map((p) => args[p.name]);
            result = await method.call(instance, ...orderedArgs);
          }

          const duration = Date.now() - startTime;

          // Build success context
          const successContext: ToolSuccessContext = {
            toolName,
            args,
            timestamp,
            result,
            duration,
          };

          // Call onToolSuccess hook
          await invokeHook(hooks, hooks?.onToolSuccess, successContext);

          // Apply @Monitor logging for success
          applyMonitorLogging(monitorOpts, 'success', { name: toolName, result, duration });

          return formatResult(result);
        } catch (error) {
          const duration = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));

          // Build error context
          const errorContext: ToolErrorContext = {
            toolName,
            args,
            timestamp,
            error: err,
            duration,
          };

          // Call onToolError hook
          await invokeHook(hooks, hooks?.onToolError, errorContext);

          // Apply @Monitor logging for error
          applyMonitorLogging(monitorOpts, 'error', { name: toolName, error: err, duration });

          return formatError(error);
        }
      };

    // Determine handler based on whether we have params
    if (inputSchema && Object.keys(inputSchema).length > 0) {
      // Tool with parameters
      server.tool(toolName, toolMeta.description ?? '', inputSchema, createHandler(true));
    } else {
      // Tool without parameters
      server.tool(toolName, toolMeta.description ?? '', createHandler(false));
    }
  }
}

/**
 * Register all resources with the MCP server
 */
function registerResources(
  server: McpServer,
  instance: object,
  resources: ResourceMetadata[],
  hooks?: ServerHooks,
): void {
  for (const resourceMeta of resources) {
    const method = (instance as Record<string | symbol, unknown>)[resourceMeta.propertyKey] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    if (typeof method !== 'function') {
      throw new BootstrapError(
        `Resource "${resourceMeta.uri}" references property "${String(resourceMeta.propertyKey)}" which is not a function`,
      );
    }

    const uriParams = extractUriParams(resourceMeta.uri);

    // Create handler with hooks
    const createResourceHandler = (hasParams: boolean) => async (uri: URL) => {
      const startTime = Date.now();
      const timestamp = startTime;

      // Build context for hooks
      const readContext: ResourceReadContext = { uri: uri.href, timestamp };

      // Call onResourceRead hook
      await invokeHook(hooks, hooks?.onResourceRead, readContext);

      try {
        let result: unknown;

        if (hasParams) {
          // Extract parameters from the actual URI
          const extractedParams = matchUriTemplate(resourceMeta.uri, uri.href);
          if (!extractedParams) {
            throw new Error(`URI ${uri.href} does not match template ${resourceMeta.uri}`);
          }

          // Call method with extracted parameters
          const orderedArgs = uriParams.map((p) => extractedParams[p]);
          result = await method.call(instance, ...orderedArgs);
        } else {
          result = await method.call(instance);
        }

        const duration = Date.now() - startTime;

        // Build success context
        const successContext: ResourceSuccessContext = { uri: uri.href, timestamp, duration };

        // Call onResourceSuccess hook
        await invokeHook(hooks, hooks?.onResourceSuccess, successContext);

        // If result is already in the right format, return it
        if (result && typeof result === 'object' && 'contents' in (result as object)) {
          return result as { contents: Array<{ uri: string; text: string; mimeType?: string }> };
        }

        // Otherwise wrap it
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: resourceMeta.mimeType ?? 'application/json',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        // Build error context
        const errorContext: ResourceErrorContext = {
          uri: uri.href,
          timestamp,
          error: err,
          duration,
        };

        // Call onResourceError hook
        await invokeHook(hooks, hooks?.onResourceError, errorContext);

        throw error;
      }
    };

    // Register as resource template if it has parameters
    if (uriParams.length > 0) {
      server.resource(
        resourceMeta.name ?? resourceMeta.uri,
        resourceMeta.uri,
        createResourceHandler(true),
      );
    } else {
      // Static resource
      server.resource(
        resourceMeta.name ?? resourceMeta.uri,
        resourceMeta.uri,
        createResourceHandler(false),
      );
    }
  }
}

/**
 * Register all prompts with the MCP server
 */
function registerPrompts(
  server: McpServer,
  instance: object,
  prototype: object,
  prompts: PromptMetadata[],
  hooks?: ServerHooks,
): void {
  for (const promptMeta of prompts) {
    const promptName = promptMeta.name ?? String(promptMeta.propertyKey);
    const method = (instance as Record<string | symbol, unknown>)[promptMeta.propertyKey] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    if (typeof method !== 'function') {
      throw new BootstrapError(
        `Prompt "${promptName}" references property "${String(promptMeta.propertyKey)}" which is not a function`,
      );
    }

    // Get parameter metadata for prompts (if any)
    const params = MetadataStorage.getParamsMetadata(prototype, promptMeta.propertyKey);

    // Create handler with hooks
    const createPromptHandler =
      (hasParams: boolean) =>
      async (args: Record<string, string> = {}) => {
        const startTime = Date.now();
        const timestamp = startTime;

        // Build context for hooks
        const getContext: PromptGetContext = {
          promptName,
          args: hasParams ? args : undefined,
          timestamp,
        };

        // Call onPromptGet hook
        await invokeHook(hooks, hooks?.onPromptGet, getContext);

        try {
          let result: unknown;

          if (hasParams) {
            const sortedParams = [...params]
              .filter((p): p is ParamMetadata => p !== undefined)
              .sort((a, b) => a.index - b.index);
            const orderedArgs = sortedParams.map((p) => args[p.name]);
            result = await method.call(instance, ...orderedArgs);
          } else {
            result = await method.call(instance);
          }

          const duration = Date.now() - startTime;

          // Build success context
          const successContext: PromptSuccessContext = {
            promptName,
            args: hasParams ? args : undefined,
            timestamp,
            duration,
          };

          // Call onPromptSuccess hook
          await invokeHook(hooks, hooks?.onPromptSuccess, successContext);

          return result as {
            messages: Array<{
              role: 'user' | 'assistant';
              content: { type: 'text'; text: string };
            }>;
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));

          // Build error context
          const errorContext: PromptErrorContext = {
            promptName,
            args: hasParams ? args : undefined,
            timestamp,
            error: err,
            duration,
          };

          // Call onPromptError hook
          await invokeHook(hooks, hooks?.onPromptError, errorContext);

          throw error;
        }
      };

    if (params.length > 0) {
      // Prompt with arguments
      const schema = buildSchemaFromParams(params) as Record<string, z.ZodTypeAny>;
      server.prompt(promptName, schema, createPromptHandler(true));
    } else {
      // Prompt without arguments - wrap handler to match expected signature
      server.prompt(promptName, async () => createPromptHandler(false)());
    }
  }
}

/**
 * Create appropriate transport based on options
 */
function createTransport(options: ListenOptions): Transport {
  const transportType = options.transport ?? 'stdio';

  switch (transportType) {
    case 'stdio':
      return new StdioServerTransport();

    case 'streamable-http':
      return new StreamableHttpTransport({
        port: options.port ?? 3000,
        host: options.host ?? 'localhost',
        path: options.path ?? '/mcp',
        stateless: options.stateless,
        enableJsonResponse: options.enableJsonResponse,
        onSessionInitialized: options.onSessionInitialized,
        onSessionClosed: options.onSessionClosed,
      });

    case 'http':
    case 'sse':
      return new SseTransport({
        port: options.port ?? 3000,
        host: options.host ?? 'localhost',
        ssePath: options.ssePath ?? '/sse',
        messagePath: options.messagePath ?? '/message',
      });

    default:
      throw new BootstrapError(`Unknown transport type: ${transportType}`);
  }
}
