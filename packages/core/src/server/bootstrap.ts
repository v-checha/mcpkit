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
import type { ListenOptions } from '../types/index.js';

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

  // Register tools
  if (hasTools) {
    registerTools(server, instance, prototype, tools);
  }

  // Register resources
  if (hasResources) {
    registerResources(server, instance, resources);
  }

  // Register prompts
  if (hasPrompts) {
    registerPrompts(server, instance, prototype, prompts);
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

    // Determine handler based on whether we have params
    if (inputSchema && Object.keys(inputSchema).length > 0) {
      // Tool with parameters
      server.tool(toolName, toolMeta.description ?? '', inputSchema, async (args) => {
        try {
          let result: unknown;

          if (toolMeta.schema) {
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

          return formatResult(result);
        } catch (error) {
          return formatError(error);
        }
      });
    } else {
      // Tool without parameters
      server.tool(toolName, toolMeta.description ?? '', async () => {
        try {
          const result = await method.call(instance);
          return formatResult(result);
        } catch (error) {
          return formatError(error);
        }
      });
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

    // Register as resource template if it has parameters
    if (uriParams.length > 0) {
      server.resource(resourceMeta.uri, resourceMeta.name ?? resourceMeta.uri, async (uri: URL) => {
        // Extract parameters from the actual URI
        const extractedParams = matchUriTemplate(resourceMeta.uri, uri.href);
        if (!extractedParams) {
          throw new Error(`URI ${uri.href} does not match template ${resourceMeta.uri}`);
        }

        // Call method with extracted parameters
        const orderedArgs = uriParams.map((p) => extractedParams[p]);
        const result = await method.call(instance, ...orderedArgs);

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
      });
    } else {
      // Static resource
      server.resource(resourceMeta.uri, resourceMeta.name ?? resourceMeta.uri, async (uri: URL) => {
        const result = await method.call(instance);

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
      });
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

    if (params.length > 0) {
      // Prompt with arguments
      const schema = buildSchemaFromParams(params) as Record<string, z.ZodTypeAny>;

      server.prompt(promptName, schema, async (args) => {
        const sortedParams = [...params]
          .filter((p): p is ParamMetadata => p !== undefined)
          .sort((a, b) => a.index - b.index);
        const orderedArgs = sortedParams.map((p) => args[p.name]);
        const result = await method.call(instance, ...orderedArgs);
        return result as {
          messages: Array<{
            role: 'user' | 'assistant';
            content: { type: 'text'; text: string };
          }>;
        };
      });
    } else {
      // Prompt without arguments
      server.prompt(promptName, async () => {
        const result = await method.call(instance);
        return result as {
          messages: Array<{
            role: 'user' | 'assistant';
            content: { type: 'text'; text: string };
          }>;
        };
      });
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
    case 'http':
    case 'streamable-http':
      throw new BootstrapError(
        `Transport "${transportType}" is not yet implemented. Use 'stdio' for now.`,
      );
    default:
      throw new BootstrapError(`Unknown transport type: ${transportType}`);
  }
}
