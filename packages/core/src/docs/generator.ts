/**
 * Documentation generator for MCP servers
 *
 * Generates documentation in multiple formats (JSON, Markdown, OpenAPI)
 * from decorated MCP server classes.
 *
 * @example
 * ```typescript
 * import { generateDocs, DocGenerator } from '@mcpkit-dev/core';
 *
 * // Simple usage
 * const markdown = await generateDocs(MyServer, { format: 'markdown' });
 * fs.writeFileSync('API.md', markdown.content);
 *
 * // Using the generator class
 * const generator = new DocGenerator(MyServer);
 * const json = generator.toJSON();
 * const md = generator.toMarkdown();
 * const openapi = generator.toOpenAPI({ serverUrl: 'http://localhost:3000' });
 * ```
 */

import type { Constructor } from '../metadata/index.js';
import { extractServerDoc, extractServerDocFromInstance } from './extractor.js';
import { formatJson, formatMarkdown, formatOpenAPI } from './formatters/index.js';
import type {
  DocFormat,
  DocGeneratorOptions,
  DocGeneratorResult,
  ServerDoc,
} from './types.js';

/**
 * Documentation generator class
 *
 * Provides a fluent API for generating documentation in various formats.
 */
export class DocGenerator {
  private doc: ServerDoc;

  /**
   * Create a new documentation generator
   *
   * @param serverOrDoc - Server class, instance, or pre-extracted documentation
   */
  constructor(serverOrDoc: Constructor | object | ServerDoc) {
    if (this.isServerDoc(serverOrDoc)) {
      this.doc = serverOrDoc;
    } else if (typeof serverOrDoc === 'function') {
      this.doc = extractServerDoc(serverOrDoc as Constructor);
    } else {
      this.doc = extractServerDocFromInstance(serverOrDoc);
    }
  }

  /**
   * Check if the input is already a ServerDoc
   */
  private isServerDoc(input: unknown): input is ServerDoc {
    return (
      typeof input === 'object' &&
      input !== null &&
      'name' in input &&
      'version' in input &&
      'tools' in input &&
      'resources' in input &&
      'prompts' in input
    );
  }

  /**
   * Get the raw documentation data
   */
  getDoc(): ServerDoc {
    return this.doc;
  }

  /**
   * Generate JSON documentation
   */
  toJSON(options?: DocGeneratorOptions): DocGeneratorResult {
    return formatJson(this.doc, options);
  }

  /**
   * Generate Markdown documentation
   */
  toMarkdown(options?: DocGeneratorOptions): DocGeneratorResult {
    return formatMarkdown(this.doc, options);
  }

  /**
   * Generate OpenAPI specification
   */
  toOpenAPI(options?: DocGeneratorOptions): DocGeneratorResult {
    return formatOpenAPI(this.doc, options);
  }

  /**
   * Generate documentation in the specified format
   */
  generate(format: DocFormat, options?: DocGeneratorOptions): DocGeneratorResult {
    switch (format) {
      case 'json':
        return this.toJSON(options);
      case 'markdown':
        return this.toMarkdown(options);
      case 'openapi':
        return this.toOpenAPI(options);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }
}

/**
 * Generate documentation from a server class or instance
 *
 * @param server - Server class or instance
 * @param options - Generator options
 * @returns Generated documentation
 *
 * @example
 * ```typescript
 * // Generate JSON
 * const json = await generateDocs(MyServer, { format: 'json' });
 *
 * // Generate Markdown
 * const md = await generateDocs(MyServer, { format: 'markdown' });
 *
 * // Generate OpenAPI
 * const openapi = await generateDocs(MyServer, {
 *   format: 'openapi',
 *   openapi: { serverUrl: 'http://localhost:3000' },
 * });
 * ```
 */
export function generateDocs(
  server: Constructor | object,
  options: DocGeneratorOptions & { format?: DocFormat } = {},
): DocGeneratorResult {
  const generator = new DocGenerator(server);
  const format = options.format ?? 'json';
  return generator.generate(format, options);
}

/**
 * Extract raw documentation from a server class
 *
 * @param server - Server class or instance
 * @returns Server documentation data
 */
export function extractDocs(server: Constructor | object): ServerDoc {
  if (typeof server === 'function') {
    return extractServerDoc(server as Constructor);
  }
  return extractServerDocFromInstance(server);
}
