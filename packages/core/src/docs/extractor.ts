/**
 * Documentation extractor for MCP servers
 *
 * Extracts documentation from decorated server classes by reading
 * metadata from decorators and combining with @Documented annotations.
 */

import 'reflect-metadata';
import { getDocumentedOptions, getServerDocumentedOptions } from '../decorators/documented.js';
import {
  type Constructor,
  MetadataStorage,
  type PromptMetadata,
  type ResourceMetadata,
  type ToolMetadata,
} from '../metadata/index.js';
import type { ParamDoc, PromptDoc, ResourceDoc, ServerDoc, ToolDoc } from './types.js';

/**
 * Generator version for tracking
 */
const GENERATOR_VERSION = '1.0.0';

/**
 * Convert TypeScript type to string representation
 */
function typeToString(type: unknown): string {
  if (type === undefined || type === null) {
    return 'unknown';
  }

  if (type === String) return 'string';
  if (type === Number) return 'number';
  if (type === Boolean) return 'boolean';
  if (type === Object) return 'object';
  if (type === Array) return 'array';

  if (typeof type === 'function' && type.name) {
    return type.name.toLowerCase();
  }

  return 'unknown';
}

/**
 * Extract parameter documentation from metadata
 */
function extractParamDocs(target: object, propertyKey: string | symbol): ParamDoc[] {
  const paramsMeta = MetadataStorage.getParamsMetadata(target, propertyKey);
  const designTypes = MetadataStorage.getDesignParamTypes(target, propertyKey);

  const docs: ParamDoc[] = [];

  for (const param of paramsMeta) {
    if (!param) continue;

    const doc: ParamDoc = {
      name: param.name,
      description: param.description,
      required: !param.optional,
      type: param.type ? typeToString(param.type) : typeToString(designTypes[param.index]),
    };

    docs.push(doc);
  }

  return docs;
}

/**
 * Extract URI parameters from a resource URI template
 */
function extractUriParams(uri: string): string[] {
  const params: string[] = [];
  const regex = /\{([^}]+)\}/g;

  for (const match of uri.matchAll(regex)) {
    if (match[1]) {
      params.push(match[1]);
    }
  }

  return params;
}

/**
 * Extract tool documentation
 */
function extractToolDoc(target: object, toolMeta: ToolMetadata): ToolDoc {
  const propertyKey = toolMeta.propertyKey;
  const documented = getDocumentedOptions(target, propertyKey);

  const doc: ToolDoc = {
    name: toolMeta.name ?? String(propertyKey),
    description: toolMeta.description,
    params: extractParamDocs(target, propertyKey),
    annotations: toolMeta.annotations,
  };

  // Merge @Documented metadata
  if (documented) {
    doc.summary = documented.summary;
    doc.examples = documented.examples;
    doc.tags = documented.tags;
    doc.deprecated = documented.deprecated;
    doc.deprecationMessage = documented.deprecationMessage;
    doc.since = documented.since;
    doc.seeAlso = documented.seeAlso;
    doc.notes = documented.notes;

    // Use detailed description from @Documented if available
    if (documented.description) {
      doc.description = documented.description;
    }
  }

  return doc;
}

/**
 * Extract resource documentation
 */
function extractResourceDoc(target: object, resourceMeta: ResourceMetadata): ResourceDoc {
  const propertyKey = resourceMeta.propertyKey;
  const documented = getDocumentedOptions(target, propertyKey);

  // Get URI parameters
  const uriParams = extractUriParams(resourceMeta.uri);
  const paramsMeta = MetadataStorage.getParamsMetadata(target, propertyKey);

  const params: ParamDoc[] = uriParams.map((paramName) => {
    const meta = paramsMeta.find((p) => p?.name === paramName);
    return {
      name: paramName,
      description: meta?.description,
      required: true, // URI params are always required
      type: meta?.type ? typeToString(meta.type) : 'string',
    };
  });

  const doc: ResourceDoc = {
    name: resourceMeta.name ?? String(propertyKey),
    uri: resourceMeta.uri,
    description: resourceMeta.description,
    mimeType: resourceMeta.mimeType,
    params,
  };

  // Merge @Documented metadata
  if (documented) {
    doc.summary = documented.summary;
    doc.examples = documented.examples;
    doc.tags = documented.tags;
    doc.deprecated = documented.deprecated;
    doc.deprecationMessage = documented.deprecationMessage;
    doc.since = documented.since;
    doc.seeAlso = documented.seeAlso;
    doc.notes = documented.notes;

    if (documented.description) {
      doc.description = documented.description;
    }
  }

  return doc;
}

/**
 * Extract prompt documentation
 */
function extractPromptDoc(target: object, promptMeta: PromptMetadata): PromptDoc {
  const propertyKey = promptMeta.propertyKey;
  const documented = getDocumentedOptions(target, propertyKey);

  const doc: PromptDoc = {
    name: promptMeta.name ?? String(propertyKey),
    description: promptMeta.description,
    params: extractParamDocs(target, propertyKey),
  };

  // Merge @Documented metadata
  if (documented) {
    doc.summary = documented.summary;
    doc.examples = documented.examples;
    doc.tags = documented.tags;
    doc.deprecated = documented.deprecated;
    doc.deprecationMessage = documented.deprecationMessage;
    doc.since = documented.since;
    doc.seeAlso = documented.seeAlso;
    doc.notes = documented.notes;

    if (documented.description) {
      doc.description = documented.description;
    }
  }

  return doc;
}

/**
 * Extract complete documentation from a decorated server class
 *
 * @param serverClass - The decorated server class
 * @returns Complete server documentation
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'my-server', version: '1.0.0' })
 * class MyServer {
 *   @Tool({ description: 'Hello tool' })
 *   hello() { return 'Hello'; }
 * }
 *
 * const docs = extractServerDoc(MyServer);
 * console.log(docs.tools); // [{ name: 'hello', description: 'Hello tool', ... }]
 * ```
 */
export function extractServerDoc(serverClass: Constructor): ServerDoc {
  const serverOptions = MetadataStorage.getServerOptions(serverClass);

  if (!serverOptions) {
    throw new Error(`Class ${serverClass.name} is not decorated with @MCPServer`);
  }

  const prototype = serverClass.prototype;
  const serverDocs = getServerDocumentedOptions(serverClass);

  // Extract tools
  const toolsMeta = MetadataStorage.getToolsMetadata(prototype);
  const tools = toolsMeta.map((meta) => extractToolDoc(prototype, meta));

  // Extract resources
  const resourcesMeta = MetadataStorage.getResourcesMetadata(prototype);
  const resources = resourcesMeta.map((meta) => extractResourceDoc(prototype, meta));

  // Extract prompts
  const promptsMeta = MetadataStorage.getPromptsMetadata(prototype);
  const prompts = promptsMeta.map((meta) => extractPromptDoc(prototype, meta));

  return {
    name: serverOptions.name,
    version: serverOptions.version,
    description: serverOptions.description ?? serverDocs?.description,
    serverDocs,
    tools,
    resources,
    prompts,
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
  };
}

/**
 * Extract documentation from a server instance
 */
export function extractServerDocFromInstance(instance: object): ServerDoc {
  const ctor = instance.constructor as Constructor;
  return extractServerDoc(ctor);
}
