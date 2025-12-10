import 'reflect-metadata';
import { MetadataStorage } from '../metadata/index.js';
import type { MonitorOptions } from '../types/hooks.js';

/**
 * Method decorator that enables monitoring for a specific tool, resource, or prompt method.
 *
 * This decorator only takes effect when `hooks` are configured on the `@MCPServer` decorator.
 * It allows fine-grained control over what gets logged for individual methods.
 *
 * @example
 * ```typescript
 * @MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 *   hooks: {
 *     onToolCall: ({ toolName }) => console.log(`Calling ${toolName}`),
 *   }
 * })
 * class MyServer {
 *   @Tool({ description: 'Process data' })
 *   @Monitor({ logArgs: true, logDuration: true })
 *   async processData(@Param({ name: 'data' }) data: string) {
 *     return `Processed: ${data}`;
 *   }
 * }
 * ```
 *
 * @param options - Monitor configuration options
 * @returns Method decorator
 */
export function Monitor(options: MonitorOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ): void {
    // Apply defaults
    const resolvedOptions: MonitorOptions = {
      logArgs: options.logArgs ?? false,
      logResult: options.logResult ?? false,
      logDuration: options.logDuration ?? true,
      logErrors: options.logErrors ?? true,
      logger: options.logger,
      errorLogger: options.errorLogger,
    };

    MetadataStorage.setMonitorOptions(target, propertyKey, resolvedOptions);
  };
}
