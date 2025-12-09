import { MetadataStorage, type PromptMetadata } from '../metadata/index.js';

/**
 * Options for the @Prompt decorator
 */
export interface PromptDecoratorOptions {
  /**
   * Prompt name - defaults to method name if not provided
   */
  name?: string;

  /**
   * Human-readable description of what the prompt does
   */
  description?: string;
}

/**
 * Method decorator that marks a method as an MCP prompt template
 *
 * Prompt methods should return a GetPromptResult-compatible object with messages.
 *
 * @example
 * ```typescript
 * @Prompt({ description: 'Generate a code review prompt' })
 * async reviewCode(
 *   @Param({ name: 'code', description: 'Code to review' }) code: string
 * ) {
 *   return {
 *     messages: [
 *       {
 *         role: 'user',
 *         content: {
 *           type: 'text',
 *           text: `Please review this code:\n\n${code}`
 *         }
 *       }
 *     ]
 *   };
 * }
 * ```
 */
export function Prompt(options: PromptDecoratorOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(
        `@Prompt decorator can only be applied to methods, received ${typeof originalMethod}`,
      );
    }

    const metadata: PromptMetadata = {
      propertyKey,
      name: options.name,
      description: options.description,
    };

    MetadataStorage.addPromptMetadata(target, metadata);

    return descriptor;
  };
}
