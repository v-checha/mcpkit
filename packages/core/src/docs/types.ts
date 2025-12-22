/**
 * Documentation types for MCP server documentation generation
 */

import type { DocumentedExample, ServerDocumentedOptions } from '../decorators/documented.js';

/**
 * Documentation for a single parameter
 */
export interface ParamDoc {
  /**
   * Parameter name
   */
  name: string;

  /**
   * Parameter description
   */
  description?: string;

  /**
   * Whether the parameter is required
   */
  required: boolean;

  /**
   * Parameter type (string representation)
   */
  type: string;

  /**
   * Default value if any
   */
  defaultValue?: unknown;
}

/**
 * Documentation for a tool
 */
export interface ToolDoc {
  /**
   * Tool name
   */
  name: string;

  /**
   * Tool description
   */
  description?: string;

  /**
   * Short summary from @Documented
   */
  summary?: string;

  /**
   * Parameters documentation
   */
  params: ParamDoc[];

  /**
   * Return type description
   */
  returns?: string;

  /**
   * Usage examples
   */
  examples?: DocumentedExample[];

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Whether the tool is deprecated
   */
  deprecated?: boolean;

  /**
   * Deprecation message
   */
  deprecationMessage?: string;

  /**
   * Version when introduced
   */
  since?: string;

  /**
   * Related tools/resources
   */
  seeAlso?: string[];

  /**
   * Notes or warnings
   */
  notes?: string[];

  /**
   * MCP annotations
   */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * Documentation for a resource
 */
export interface ResourceDoc {
  /**
   * Resource name
   */
  name: string;

  /**
   * Resource URI template
   */
  uri: string;

  /**
   * Resource description
   */
  description?: string;

  /**
   * Short summary from @Documented
   */
  summary?: string;

  /**
   * MIME type
   */
  mimeType?: string;

  /**
   * URI parameters
   */
  params: ParamDoc[];

  /**
   * Usage examples
   */
  examples?: DocumentedExample[];

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Whether the resource is deprecated
   */
  deprecated?: boolean;

  /**
   * Deprecation message
   */
  deprecationMessage?: string;

  /**
   * Version when introduced
   */
  since?: string;

  /**
   * Related resources
   */
  seeAlso?: string[];

  /**
   * Notes or warnings
   */
  notes?: string[];
}

/**
 * Documentation for a prompt
 */
export interface PromptDoc {
  /**
   * Prompt name
   */
  name: string;

  /**
   * Prompt description
   */
  description?: string;

  /**
   * Short summary from @Documented
   */
  summary?: string;

  /**
   * Prompt arguments
   */
  params: ParamDoc[];

  /**
   * Usage examples
   */
  examples?: DocumentedExample[];

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Whether the prompt is deprecated
   */
  deprecated?: boolean;

  /**
   * Deprecation message
   */
  deprecationMessage?: string;

  /**
   * Version when introduced
   */
  since?: string;

  /**
   * Related prompts
   */
  seeAlso?: string[];

  /**
   * Notes or warnings
   */
  notes?: string[];
}

/**
 * Complete server documentation
 */
export interface ServerDoc {
  /**
   * Server name
   */
  name: string;

  /**
   * Server version
   */
  version: string;

  /**
   * Server description
   */
  description?: string;

  /**
   * Server-level documentation
   */
  serverDocs?: ServerDocumentedOptions;

  /**
   * Available tools
   */
  tools: ToolDoc[];

  /**
   * Available resources
   */
  resources: ResourceDoc[];

  /**
   * Available prompts
   */
  prompts: PromptDoc[];

  /**
   * Generation timestamp
   */
  generatedAt: string;

  /**
   * Generator version
   */
  generatorVersion: string;
}

/**
 * Output format for documentation
 */
export type DocFormat = 'json' | 'markdown' | 'openapi';

/**
 * Options for documentation generation
 */
export interface DocGeneratorOptions {
  /**
   * Output format
   * @default 'json'
   */
  format?: DocFormat;

  /**
   * Include examples in output
   * @default true
   */
  includeExamples?: boolean;

  /**
   * Include deprecated items
   * @default true
   */
  includeDeprecated?: boolean;

  /**
   * Filter by tags (include only items with these tags)
   */
  filterTags?: string[];

  /**
   * OpenAPI specific options
   */
  openapi?: {
    /**
     * Server URL for OpenAPI spec
     */
    serverUrl?: string;

    /**
     * Additional OpenAPI info
     */
    info?: {
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
    };
  };
}

/**
 * Result of documentation generation
 */
export interface DocGeneratorResult {
  /**
   * Generated documentation content
   */
  content: string;

  /**
   * Output format
   */
  format: DocFormat;

  /**
   * Suggested file extension
   */
  extension: string;
}
