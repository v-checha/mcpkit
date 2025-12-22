import 'reflect-metadata';
import type { ZodTypeAny } from 'zod';
import type { MiddlewareInput } from '../middleware/types.js';
import type { PluginInput } from '../plugins/types.js';
import type { MonitorOptions, ServerHooks } from '../types/hooks.js';
import { METADATA_KEYS } from './keys.js';

/**
 * Metadata for a tool method
 */
export interface ToolMetadata {
  /** Method property key */
  propertyKey: string | symbol;
  /** Tool name (defaults to method name) */
  name?: string;
  /** Human-readable description */
  description?: string;
  /** Explicit Zod schema for all parameters */
  schema?: ZodTypeAny;
  /** MCP tool annotations */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * Metadata for a resource method
 */
export interface ResourceMetadata {
  /** Method property key */
  propertyKey: string | symbol;
  /** URI template (e.g., 'weather://cities/{city}/forecast') */
  uri: string;
  /** Resource display name */
  name?: string;
  /** Human-readable description */
  description?: string;
  /** MIME type of resource content */
  mimeType?: string;
}

/**
 * Metadata for a prompt method
 */
export interface PromptMetadata {
  /** Method property key */
  propertyKey: string | symbol;
  /** Prompt name (defaults to method name) */
  name?: string;
  /** Human-readable description */
  description?: string;
}

/**
 * Metadata for a method parameter
 */
export interface ParamMetadata {
  /** Parameter index (0-based) */
  index: number;
  /** Parameter name (required for schema generation) */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Design-time type from TypeScript */
  type?: unknown;
  /** Explicit Zod schema */
  schema?: ZodTypeAny;
  /** Whether parameter is optional */
  optional?: boolean;
}

/**
 * Server configuration options from @MCPServer decorator
 */
export interface ServerOptionsMetadata {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Capability flags */
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  /** Server lifecycle and monitoring hooks */
  hooks?: ServerHooks;
  /** Middleware for HTTP transports */
  middleware?: MiddlewareInput[];
  /** Plugins for extending functionality */
  plugins?: PluginInput[];
}

/**
 * Monitor decorator options stored in metadata
 */
export interface MonitorMetadata {
  /** The method property key */
  propertyKey: string | symbol;
  /** Monitor options */
  options: MonitorOptions;
}

/**
 * Constructor function type for decorated classes
 */
// biome-ignore lint/complexity/noBannedTypes: Required for class constructor typing in decorators
export type Constructor = Function;

/**
 * Central storage for decorator metadata using reflect-metadata
 *
 * This class uses static methods intentionally as it serves as a namespace
 * for metadata operations using the reflect-metadata API.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional static utility class for metadata storage
export class MetadataStorage {
  /**
   * Store server options metadata on a class constructor
   */
  static setServerOptions(target: Constructor, options: ServerOptionsMetadata): void {
    Reflect.defineMetadata(METADATA_KEYS.SERVER_OPTIONS, options, target);
  }

  /**
   * Retrieve server options from a class constructor
   */
  static getServerOptions(target: Constructor): ServerOptionsMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEYS.SERVER_OPTIONS, target);
  }

  /**
   * Add tool metadata to a class prototype
   */
  static addToolMetadata(target: object, metadata: ToolMetadata): void {
    const existingTools = MetadataStorage.getToolsMetadata(target);
    existingTools.push(metadata);
    Reflect.defineMetadata(METADATA_KEYS.TOOLS, existingTools, target);
  }

  /**
   * Retrieve all tool metadata from a class prototype
   */
  static getToolsMetadata(target: object): ToolMetadata[] {
    return Reflect.getMetadata(METADATA_KEYS.TOOLS, target) ?? [];
  }

  /**
   * Add resource metadata to a class prototype
   */
  static addResourceMetadata(target: object, metadata: ResourceMetadata): void {
    const existingResources = MetadataStorage.getResourcesMetadata(target);
    existingResources.push(metadata);
    Reflect.defineMetadata(METADATA_KEYS.RESOURCES, existingResources, target);
  }

  /**
   * Retrieve all resource metadata from a class prototype
   */
  static getResourcesMetadata(target: object): ResourceMetadata[] {
    return Reflect.getMetadata(METADATA_KEYS.RESOURCES, target) ?? [];
  }

  /**
   * Add prompt metadata to a class prototype
   */
  static addPromptMetadata(target: object, metadata: PromptMetadata): void {
    const existingPrompts = MetadataStorage.getPromptsMetadata(target);
    existingPrompts.push(metadata);
    Reflect.defineMetadata(METADATA_KEYS.PROMPTS, existingPrompts, target);
  }

  /**
   * Retrieve all prompt metadata from a class prototype
   */
  static getPromptsMetadata(target: object): PromptMetadata[] {
    return Reflect.getMetadata(METADATA_KEYS.PROMPTS, target) ?? [];
  }

  /**
   * Store parameter metadata for a specific method
   * Parameters are stored in an array indexed by parameter position
   */
  static addParamMetadata(
    target: object,
    propertyKey: string | symbol,
    metadata: ParamMetadata,
  ): void {
    const key = MetadataStorage.getParamKey(propertyKey);
    const existingParams = MetadataStorage.getParamsMetadata(target, propertyKey);
    existingParams[metadata.index] = metadata;
    Reflect.defineMetadata(key, existingParams, target);
  }

  /**
   * Get parameter metadata for a specific method
   * Returns array indexed by parameter position (may have gaps)
   */
  static getParamsMetadata(target: object, propertyKey: string | symbol): ParamMetadata[] {
    const key = MetadataStorage.getParamKey(propertyKey);
    return Reflect.getMetadata(key, target) ?? [];
  }

  /**
   * Get design-time parameter types from TypeScript metadata
   * Requires emitDecoratorMetadata: true in tsconfig
   */
  static getDesignParamTypes(target: object, propertyKey: string | symbol): unknown[] {
    return Reflect.getMetadata(METADATA_KEYS.DESIGN_PARAMTYPES, target, propertyKey) ?? [];
  }

  /**
   * Get design-time return type from TypeScript metadata
   */
  static getDesignReturnType(target: object, propertyKey: string | symbol): unknown {
    return Reflect.getMetadata(METADATA_KEYS.DESIGN_RETURNTYPE, target, propertyKey);
  }

  /**
   * Generate unique key for parameter metadata
   */
  private static getParamKey(propertyKey: string | symbol): string {
    return `${METADATA_KEYS.PARAMS.toString()}:${String(propertyKey)}`;
  }

  /**
   * Generate unique key for monitor metadata
   */
  private static getMonitorKey(propertyKey: string | symbol): string {
    return `${METADATA_KEYS.MONITOR.toString()}:${String(propertyKey)}`;
  }

  /**
   * Store monitor options for a specific method
   */
  static setMonitorOptions(
    target: object,
    propertyKey: string | symbol,
    options: MonitorOptions,
  ): void {
    const key = MetadataStorage.getMonitorKey(propertyKey);
    Reflect.defineMetadata(key, options, target);
  }

  /**
   * Get monitor options for a specific method
   */
  static getMonitorOptions(
    target: object,
    propertyKey: string | symbol,
  ): MonitorOptions | undefined {
    const key = MetadataStorage.getMonitorKey(propertyKey);
    return Reflect.getMetadata(key, target);
  }
}
