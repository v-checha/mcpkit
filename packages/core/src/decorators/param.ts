import type { ZodTypeAny } from 'zod';
import { MetadataStorage } from '../metadata/index.js';

/**
 * Options for the @Param decorator
 */
export interface ParamDecoratorOptions {
  /**
   * The Parameter name REQUIRED for schema generation
   * Must match what will be sent in the tool call
   */
  name: string;

  /**
   * Human-readable description of the parameter
   * Used in JSON Schema and documentation
   */
  description?: string;

  /**
   * Explicit Zod schema for this parameter,
   * If not provided, will be inferred from TypeScript type
   */
  schema?: ZodTypeAny;

  /**
   * Whether this parameter is optional
   * @default false
   */
  optional?: boolean;
}

/**
 * Parameter decorator that provides metadata for tool parameters
 *
 * @example
 * ```typescript
 * @Tool({ description: 'Get weather' })
 * async getWeather(
 *   @Param({ name: 'city', description: 'City name' }) city: string,
 *   @Param({ name: 'unit', optional: true }) unit?: 'celsius' | 'fahrenheit'
 * ) { ... }
 * ```
 */
export function Param(options: ParamDecoratorOptions): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ): void {
    if (propertyKey === undefined) {
      throw new Error(
        '@Param decorator can only be used on method parameters, not constructor parameters',
      );
    }

    // Get design-time type from TypeScript metadata (if available)
    const designTypes = MetadataStorage.getDesignParamTypes(target, propertyKey);
    const designType = designTypes[parameterIndex];

    MetadataStorage.addParamMetadata(target, propertyKey, {
      index: parameterIndex,
      name: options.name,
      description: options.description,
      type: designType,
      schema: options.schema,
      optional: options.optional ?? false,
    });
  };
}
