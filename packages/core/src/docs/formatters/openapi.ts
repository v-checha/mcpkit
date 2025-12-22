/**
 * OpenAPI 3.0 formatter for server documentation
 *
 * Maps MCP tools to HTTP POST endpoints for documentation purposes.
 * This allows MCP servers to be documented using standard OpenAPI tooling.
 */

import type {
  DocGeneratorOptions,
  DocGeneratorResult,
  ParamDoc,
  PromptDoc,
  ResourceDoc,
  ServerDoc,
  ToolDoc,
} from '../types.js';

/**
 * OpenAPI 3.0 specification interfaces
 */
interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocs;
}

interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

interface OpenAPIServer {
  url: string;
  description?: string;
}

interface OpenAPIPathItem {
  post?: OpenAPIOperation;
  get?: OpenAPIOperation;
}

interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  externalDocs?: OpenAPIExternalDocs;
}

interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: OpenAPISchema;
}

interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

interface OpenAPIMediaType {
  schema: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  deprecated?: boolean;
}

interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  securitySchemes?: Record<string, unknown>;
}

interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocs;
}

interface OpenAPIExternalDocs {
  description?: string;
  url: string;
}

interface OpenAPIExample {
  summary?: string;
  description?: string;
  value: unknown;
}

/**
 * Map TypeScript/MCP type to OpenAPI type
 */
function mapType(type: string): { type: string; format?: string } {
  switch (type.toLowerCase()) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'array':
      return { type: 'array' };
    case 'object':
      return { type: 'object' };
    case 'integer':
      return { type: 'integer' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    default:
      return { type: 'string' };
  }
}

/**
 * Create schema for parameters
 */
function createParamsSchema(params: ParamDoc[]): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {};
  const required: string[] = [];

  for (const param of params) {
    const typeInfo = mapType(param.type);

    properties[param.name] = {
      ...typeInfo,
      description: param.description,
    };

    if (param.defaultValue !== undefined) {
      const prop = properties[param.name];
      if (prop) {
        prop.default = param.defaultValue;
      }
    }

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Create tool operation
 */
function createToolOperation(tool: ToolDoc): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    operationId: tool.name,
    summary: tool.summary ?? tool.description?.split('\n')[0],
    description: tool.description,
    tags: tool.tags,
    deprecated: tool.deprecated,
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                content: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['text', 'image', 'resource'] },
                      text: { type: 'string' },
                    },
                  },
                },
                isError: { type: 'boolean' },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid parameters',
      },
      '500': {
        description: 'Server error',
      },
    },
  };

  // Add request body for parameters
  if (tool.params.length > 0) {
    const schema = createParamsSchema(tool.params);

    operation.requestBody = {
      required: tool.params.some((p) => p.required),
      content: {
        'application/json': {
          schema,
        },
      },
    };

    // Add examples
    if (tool.examples && tool.examples.length > 0) {
      const examples: Record<string, OpenAPIExample> = {};

      for (const example of tool.examples) {
        examples[example.name.replace(/\s+/g, '_').toLowerCase()] = {
          summary: example.name,
          description: example.description,
          value: example.input,
        };
      }

      const jsonContent = operation.requestBody?.content['application/json'];
      if (jsonContent) {
        jsonContent.examples = examples;
      }
    }
  }

  return operation;
}

/**
 * Create resource operation
 */
function createResourceOperation(resource: ResourceDoc): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    operationId: `get_${resource.name}`,
    summary: resource.summary ?? resource.description?.split('\n')[0],
    description: resource.description,
    tags: resource.tags,
    deprecated: resource.deprecated,
    responses: {
      '200': {
        description: 'Resource content',
        content: {
          [resource.mimeType ?? 'application/json']: {
            schema: {
              type: 'object',
              properties: {
                uri: { type: 'string' },
                mimeType: { type: 'string' },
                text: { type: 'string' },
                blob: { type: 'string', format: 'byte' },
              },
            },
          },
        },
      },
      '404': {
        description: 'Resource not found',
      },
    },
  };

  // Add URI parameters
  if (resource.params.length > 0) {
    operation.parameters = resource.params.map((param) => ({
      name: param.name,
      in: 'path' as const,
      description: param.description,
      required: true,
      schema: mapType(param.type),
    }));
  }

  return operation;
}

/**
 * Create prompt operation
 */
function createPromptOperation(prompt: PromptDoc): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    operationId: `prompt_${prompt.name}`,
    summary: prompt.summary ?? prompt.description?.split('\n')[0],
    description: prompt.description,
    tags: prompt.tags,
    deprecated: prompt.deprecated,
    responses: {
      '200': {
        description: 'Prompt messages',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      role: { type: 'string', enum: ['user', 'assistant'] },
                      content: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          text: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  // Add request body for arguments
  if (prompt.params.length > 0) {
    const schema = createParamsSchema(prompt.params);

    operation.requestBody = {
      required: prompt.params.some((p) => p.required),
      content: {
        'application/json': {
          schema,
        },
      },
    };

    // Add examples
    if (prompt.examples && prompt.examples.length > 0) {
      const examples: Record<string, OpenAPIExample> = {};

      for (const example of prompt.examples) {
        examples[example.name.replace(/\s+/g, '_').toLowerCase()] = {
          summary: example.name,
          description: example.description,
          value: example.input,
        };
      }

      const jsonContent = operation.requestBody?.content['application/json'];
      if (jsonContent) {
        jsonContent.examples = examples;
      }
    }
  }

  return operation;
}

/**
 * Convert URI template from MCP format to OpenAPI format
 * MCP: weather://cities/{city}/forecast
 * OpenAPI: /resources/weather/cities/{city}/forecast
 */
function convertUriTemplate(uri: string): string {
  // Remove protocol
  const withoutProtocol = uri.replace(/^[a-z]+:\/\//, '');

  // Replace {param} with {param} (already OpenAPI compatible)
  return `/resources/${withoutProtocol}`;
}

/**
 * Format server documentation as OpenAPI 3.0 specification
 *
 * @param doc - Server documentation
 * @param options - Generator options
 * @returns OpenAPI 3.0 specification
 *
 * @example
 * ```typescript
 * const docs = extractServerDoc(MyServer);
 * const result = formatOpenAPI(docs, {
 *   openapi: {
 *     serverUrl: 'http://localhost:3000',
 *   },
 * });
 * fs.writeFileSync('openapi.json', result.content);
 * ```
 */
export function formatOpenAPI(
  doc: ServerDoc,
  options: DocGeneratorOptions = {},
): DocGeneratorResult {
  // Collect all unique tags
  const tagSet = new Set<string>();
  const collectTags = (item: { tags?: string[] }) => {
    item.tags?.forEach((t) => {
      tagSet.add(t);
    });
  };

  doc.tools.forEach(collectTags);
  doc.resources.forEach(collectTags);
  doc.prompts.forEach(collectTags);

  // Add default tags
  if (doc.tools.length > 0) tagSet.add('tools');
  if (doc.resources.length > 0) tagSet.add('resources');
  if (doc.prompts.length > 0) tagSet.add('prompts');

  // Build tags array
  const tags: OpenAPITag[] = [];

  // Add server-defined tags first
  if (doc.serverDocs?.tags) {
    for (const tag of doc.serverDocs.tags) {
      tags.push({
        name: tag.name,
        description: tag.description,
      });
      tagSet.delete(tag.name);
    }
  }

  // Add default category tags
  if (doc.tools.length > 0 && !tags.find((t) => t.name === 'tools')) {
    tags.push({ name: 'tools', description: 'MCP Tools' });
    tagSet.delete('tools');
  }
  if (doc.resources.length > 0 && !tags.find((t) => t.name === 'resources')) {
    tags.push({ name: 'resources', description: 'MCP Resources' });
    tagSet.delete('resources');
  }
  if (doc.prompts.length > 0 && !tags.find((t) => t.name === 'prompts')) {
    tags.push({ name: 'prompts', description: 'MCP Prompts' });
    tagSet.delete('prompts');
  }

  // Add remaining tags
  for (const tag of tagSet) {
    tags.push({ name: tag });
  }

  // Build paths
  const paths: Record<string, OpenAPIPathItem> = {};

  // Add tool endpoints
  for (const tool of doc.tools) {
    if (!options.includeDeprecated && tool.deprecated) continue;

    const toolTags = tool.tags ? [...tool.tags, 'tools'] : ['tools'];
    const operation = createToolOperation(tool);
    operation.tags = toolTags;

    paths[`/tools/${tool.name}`] = {
      post: operation,
    };
  }

  // Add resource endpoints
  for (const resource of doc.resources) {
    if (!options.includeDeprecated && resource.deprecated) continue;

    const resourceTags = resource.tags ? [...resource.tags, 'resources'] : ['resources'];
    const operation = createResourceOperation(resource);
    operation.tags = resourceTags;

    const path = convertUriTemplate(resource.uri);
    paths[path] = {
      get: operation,
    };
  }

  // Add prompt endpoints
  for (const prompt of doc.prompts) {
    if (!options.includeDeprecated && prompt.deprecated) continue;

    const promptTags = prompt.tags ? [...prompt.tags, 'prompts'] : ['prompts'];
    const operation = createPromptOperation(prompt);
    operation.tags = promptTags;

    paths[`/prompts/${prompt.name}`] = {
      post: operation,
    };
  }

  // Build spec
  const spec: OpenAPISpec = {
    openapi: '3.0.3',
    info: {
      title: doc.name,
      version: doc.version,
      description: doc.description,
    },
    paths,
    tags,
  };

  // Add OpenAPI options
  if (options.openapi?.info) {
    Object.assign(spec.info, options.openapi.info);
  }

  // Add server documentation
  if (doc.serverDocs) {
    if (doc.serverDocs.contact) {
      spec.info.contact = doc.serverDocs.contact;
    }
    if (doc.serverDocs.license) {
      spec.info.license = doc.serverDocs.license;
    }
    if (doc.serverDocs.externalDocs) {
      spec.externalDocs = doc.serverDocs.externalDocs;
    }
  }

  // Add server URL
  if (options.openapi?.serverUrl) {
    spec.servers = [
      {
        url: options.openapi.serverUrl,
        description: 'MCP Server',
      },
    ];
  }

  return {
    content: JSON.stringify(spec, null, 2),
    format: 'openapi',
    extension: '.openapi.json',
  };
}
