import type { ZodTypeAny } from 'zod';
import { MetadataStorage, type ToolMetadata } from '../metadata/index.js';

/**
 * Tool annotations following MCP specification
 */
export interface ToolAnnotations {
  /**
   * Human-readable title for the tool
   */
  title?: string;

  /**
   * If true, the tool only reads data and doesn't modify state
   */
  readOnlyHint?: boolean;

  /**
   * If true, the tool may perform destructive operations
   */
  destructiveHint?: boolean;

  /**
   * If true, calling the tool multiple times with same args has same effect
   */
  idempotentHint?: boolean;

  /**
   * If true, the tool interacts with external systems
   */
  openWorldHint?: boolean;
}

/**
 * Options for the @Tool decorator
 */
export interface ToolDecoratorOptions {
  /**
   * Tool name - defaults to method name if not provided
   */
  name?: string;

  /**
   * Human-readable description of what the tool does
   * Shown to the AI model to help it understand when to use the tool
   */
  description?: string;

  /**
   * Explicit Zod schema for tool parameters
   * Alternative to using @Param decorators on individual parameters
   * If provided, this takes precedence over @Param metadata
   */
  schema?: ZodTypeAny;

  /**
   * MCP tool annotations for additional metadata
   */
  annotations?: ToolAnnotations;
}

/**
 * Method decorator that marks a method as an MCP tool
 *
 * @example
 * ```typescript
 * // Using @Param decorators
 * @Tool({ description: 'Get current weather' })
 * async getWeather(
 *   @Param({ name: 'city' }) city: string
 * ) { ... }
 *
 * // Using explicit schema
 * @Tool({
 *   description: 'Get weather forecast',
 *   schema: z.object({
 *     city: z.string(),
 *     days: z.number().min(1).max(7)
 *   })
 * })
 * async getForecast(args: { city: string; days: number }) { ... }
 * ```
 */
export function Tool(options: ToolDecoratorOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(
        `@Tool decorator can only be applied to methods, received ${typeof originalMethod}`,
      );
    }

    const metadata: ToolMetadata = {
      propertyKey,
      name: options.name,
      description: options.description,
      schema: options.schema,
      annotations: options.annotations,
    };

    MetadataStorage.addToolMetadata(target, metadata);

    return descriptor;
  };
}
