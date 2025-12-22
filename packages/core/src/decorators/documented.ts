import 'reflect-metadata';

/**
 * Example input/output for documentation
 */
export interface DocumentedExample {
  /**
   * Name/description of the example
   */
  name: string;

  /**
   * Example input values
   */
  input?: Record<string, unknown>;

  /**
   * Expected output
   */
  output?: unknown;

  /**
   * Description of what this example demonstrates
   */
  description?: string;
}

/**
 * Options for the @Documented decorator
 */
export interface DocumentedOptions {
  /**
   * Short summary (one line)
   */
  summary?: string;

  /**
   * Detailed description (can be multi-line markdown)
   */
  description?: string;

  /**
   * Usage examples
   */
  examples?: DocumentedExample[];

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Mark as deprecated
   */
  deprecated?: boolean;

  /**
   * Deprecation message explaining what to use instead
   */
  deprecationMessage?: string;

  /**
   * Version when this was introduced
   */
  since?: string;

  /**
   * Related tools/resources/prompts
   */
  seeAlso?: string[];

  /**
   * Notes or warnings
   */
  notes?: string[];
}

/**
 * Metadata key for documented options
 */
const DOCUMENTED_KEY = Symbol('mcpkit:documented');

/**
 * Method decorator for enhanced documentation metadata
 *
 * Adds additional documentation to tools, resources, and prompts
 * that can be extracted for API documentation generation.
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'my-server', version: '1.0.0' })
 * class MyServer {
 *   @Tool({ description: 'Fetch weather data' })
 *   @Documented({
 *     summary: 'Get current weather for a city',
 *     tags: ['weather', 'external-api'],
 *     examples: [
 *       {
 *         name: 'Get NYC weather',
 *         input: { city: 'New York' },
 *         output: { temp: 72, conditions: 'sunny' },
 *       },
 *     ],
 *     since: '1.0.0',
 *   })
 *   async getWeather(@Param({ name: 'city' }) city: string) {
 *     // ...
 *   }
 * }
 * ```
 */
export function Documented(options: DocumentedOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ): void {
    // Store documented metadata
    const key = `${DOCUMENTED_KEY.toString()}:${String(propertyKey)}`;
    Reflect.defineMetadata(key, options, target);
  };
}

/**
 * Get documented options for a method
 */
export function getDocumentedOptions(
  target: object,
  propertyKey: string | symbol,
): DocumentedOptions | undefined {
  const key = `${DOCUMENTED_KEY.toString()}:${String(propertyKey)}`;
  return Reflect.getMetadata(key, target);
}

/**
 * Class decorator for server-level documentation
 */
export interface ServerDocumentedOptions {
  /**
   * Detailed description of the server
   */
  description?: string;

  /**
   * Contact information
   */
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };

  /**
   * License information
   */
  license?: {
    name: string;
    url?: string;
  };

  /**
   * External documentation link
   */
  externalDocs?: {
    description?: string;
    url: string;
  };

  /**
   * Tags with descriptions for categorizing operations
   */
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * Metadata key for server documentation
 */
const SERVER_DOCUMENTED_KEY = Symbol('mcpkit:serverDocumented');

/**
 * Class decorator for server-level documentation
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'weather-api', version: '1.0.0' })
 * @ServerDocumented({
 *   description: 'Weather data API providing current conditions and forecasts',
 *   contact: { email: 'api@example.com' },
 *   license: { name: 'MIT' },
 *   tags: [
 *     { name: 'weather', description: 'Weather-related operations' },
 *     { name: 'forecast', description: 'Forecast operations' },
 *   ],
 * })
 * class WeatherServer { ... }
 * ```
 */
export function ServerDocumented(
  options: ServerDocumentedOptions,
): ClassDecorator {
  return function (target: object): void {
    Reflect.defineMetadata(SERVER_DOCUMENTED_KEY, options, target);
  };
}

/**
 * Get server documented options
 */
export function getServerDocumentedOptions(
  target: object,
): ServerDocumentedOptions | undefined {
  return Reflect.getMetadata(SERVER_DOCUMENTED_KEY, target);
}
