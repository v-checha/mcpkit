import { MetadataStorage, type ResourceMetadata } from '../metadata/index.js';

/**
 * Options for the @Resource decorator
 */
export interface ResourceDecoratorOptions {
  /**
   * URI template with placeholders for parameters
   * e.g., 'weather://cities/{city}/forecast'
   */
  uri: string;

  /**
   * Display name for the resource
   */
  name?: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * MIME type of the resource content
   * @default 'application/json'
   */
  mimeType?: string;
}

/**
 * Method decorator that marks a method as an MCP resource handler
 *
 * Can be used with just a URI string or with full options object.
 *
 * @example
 * ```typescript
 * // Simple URI template
 * @Resource('weather://cities/{city}/forecast')
 * async getCityForecast(city: string) {
 *   return {
 *     contents: [{
 *       uri: `weather://cities/${city}/forecast`,
 *       mimeType: 'application/json',
 *       text: JSON.stringify({ ... })
 *     }]
 *   };
 * }
 *
 * // With full options
 * @Resource({
 *   uri: 'docs://readme',
 *   name: 'README',
 *   description: 'Project readme file',
 *   mimeType: 'text/markdown'
 * })
 * async getReadme() { ... }
 * ```
 */
export function Resource(uriOrOptions: string | ResourceDecoratorOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(
        `@Resource decorator can only be applied to methods, received ${typeof originalMethod}`,
      );
    }

    const options: ResourceDecoratorOptions =
      typeof uriOrOptions === 'string' ? { uri: uriOrOptions } : uriOrOptions;

    const metadata: ResourceMetadata = {
      propertyKey,
      uri: options.uri,
      name: options.name,
      description: options.description,
      mimeType: options.mimeType,
    };

    MetadataStorage.addResourceMetadata(target, metadata);

    return descriptor;
  };
}
