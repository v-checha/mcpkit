import 'reflect-metadata';

/**
 * Debug log level
 */
export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Custom debug logger interface
 */
export interface DebugLogger {
  log(level: DebugLevel, message: string, data?: Record<string, unknown>): void;
}

/**
 * Debug context provided to loggers
 */
export interface DebugContext {
  /**
   * Type of operation (tool, resource, prompt)
   */
  type: 'tool' | 'resource' | 'prompt';

  /**
   * Name of the operation
   */
  name: string;

  /**
   * Method name
   */
  method: string;

  /**
   * Input arguments
   */
  args?: unknown[];

  /**
   * Result of the operation
   */
  result?: unknown;

  /**
   * Error if any
   */
  error?: Error;

  /**
   * Execution duration in milliseconds
   */
  duration?: number;

  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;

  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Options for the @Debug decorator
 */
export interface DebugOptions {
  /**
   * Enable/disable debug logging
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum log level
   * @default 'debug'
   */
  level?: DebugLevel;

  /**
   * Log input arguments
   * @default true
   */
  logArgs?: boolean;

  /**
   * Log result/output
   * @default true
   */
  logResult?: boolean;

  /**
   * Log execution duration
   * @default true
   */
  logDuration?: boolean;

  /**
   * Custom logger implementation
   */
  logger?: DebugLogger;

  /**
   * Sanitize sensitive data from logs
   * Returns sanitized data or undefined to skip that argument
   */
  sanitize?: (key: string, value: unknown) => unknown;

  /**
   * Custom label for log output
   */
  label?: string;
}

/**
 * Metadata key for debug options
 */
const DEBUG_KEY = Symbol('mcpkit:debug');

/**
 * Global debug configuration
 */
let globalDebugConfig: DebugOptions = {
  enabled: process.env.NODE_ENV === 'development' || process.env.MCPKIT_DEBUG === 'true',
  level: 'debug',
  logArgs: true,
  logResult: true,
  logDuration: true,
};

/**
 * Configure global debug settings
 */
export function configureDebug(options: Partial<DebugOptions>): void {
  globalDebugConfig = { ...globalDebugConfig, ...options };
}

/**
 * Get current global debug configuration
 */
export function getDebugConfig(): DebugOptions {
  return { ...globalDebugConfig };
}

/**
 * Default console logger
 *
 * IMPORTANT: All output goes to stderr to avoid corrupting the stdio transport.
 * For MCP servers using stdio, stdout is reserved for JSON-RPC messages.
 */
const defaultLogger: DebugLogger = {
  log(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const formattedData = data ? ` ${JSON.stringify(data, null, 2)}` : '';

    // Always use stderr to avoid corrupting stdio transport
    // In MCP stdio transport, stdout is reserved for JSON-RPC messages
    console.error(`${prefix} ${message}${formattedData}`);
  },
};

/**
 * Log level priority
 */
const levelPriority: Record<DebugLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/**
 * Check if a level should be logged
 */
function shouldLog(level: DebugLevel, minLevel: DebugLevel): boolean {
  return levelPriority[level] >= levelPriority[minLevel];
}

/**
 * Sanitize value for logging
 */
function sanitizeValue(
  key: string,
  value: unknown,
  sanitizer?: (key: string, value: unknown) => unknown,
): unknown {
  if (sanitizer) {
    return sanitizer(key, value);
  }

  // Default sanitization - hide sensitive fields
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];
  if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
    return '[REDACTED]';
  }

  return value;
}

/**
 * Create debug wrapper for a method
 */
function createDebugWrapper(
  originalMethod: (...args: unknown[]) => unknown,
  options: DebugOptions,
  context: Omit<DebugContext, 'timestamp' | 'args' | 'result' | 'error' | 'duration'>,
): (...args: unknown[]) => unknown {
  return async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    const config = { ...globalDebugConfig, ...options };

    if (!config.enabled) {
      return originalMethod.apply(this, args);
    }

    const logger = config.logger ?? defaultLogger;
    const minLevel = config.level ?? 'debug';
    const label = config.label ?? `${context.type}:${context.name}`;

    const debugContext: DebugContext = {
      ...context,
      timestamp: new Date(),
    };

    // Log entry
    if (shouldLog('debug', minLevel)) {
      const logData: Record<string, unknown> = {
        type: context.type,
        name: context.name,
      };

      if (config.logArgs && args.length > 0) {
        logData.args = args.map((arg, i) => sanitizeValue(`arg${i}`, arg, config.sanitize));
        debugContext.args = args;
      }

      logger.log('debug', `→ ${label}`, logData);
    }

    const startTime = Date.now();

    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;

      debugContext.duration = duration;
      debugContext.result = result;

      // Log success
      if (shouldLog('debug', minLevel)) {
        const logData: Record<string, unknown> = {
          type: context.type,
          name: context.name,
        };

        if (config.logDuration) {
          logData.duration = `${duration}ms`;
        }

        if (config.logResult && result !== undefined) {
          logData.result = sanitizeValue('result', result, config.sanitize);
        }

        logger.log('debug', `← ${label} ✓`, logData);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      debugContext.duration = duration;
      debugContext.error = error instanceof Error ? error : new Error(String(error));

      // Log error
      if (shouldLog('error', minLevel)) {
        const logData: Record<string, unknown> = {
          type: context.type,
          name: context.name,
          error: debugContext.error.message,
        };

        if (config.logDuration) {
          logData.duration = `${duration}ms`;
        }

        logger.log('error', `← ${label} ✗`, logData);
      }

      throw error;
    }
  };
}

/**
 * Method decorator for debug logging
 *
 * Adds detailed logging for tool, resource, and prompt methods including:
 * - Input arguments
 * - Execution duration
 * - Results or errors
 *
 * @example
 * ```typescript
 * @MCPServer({ name: 'my-server', version: '1.0.0' })
 * class MyServer {
 *   @Tool({ description: 'Process data' })
 *   @Debug({ logArgs: true, logResult: true })
 *   async processData(@Param({ name: 'input' }) input: string) {
 *     // Processing will be logged with timing
 *     return { processed: input };
 *   }
 *
 *   @Tool({ description: 'Sensitive operation' })
 *   @Debug({
 *     sanitize: (key, value) => {
 *       if (key === 'password') return '[HIDDEN]';
 *       return value;
 *     },
 *   })
 *   async login(@Param({ name: 'password' }) password: string) {
 *     // Password will be sanitized in logs
 *   }
 * }
 * ```
 */
export function Debug(options: DebugOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Store debug metadata
    const key = `${DEBUG_KEY.toString()}:${String(propertyKey)}`;
    Reflect.defineMetadata(key, options, target);

    // Get the operation type from existing metadata
    const tools = Reflect.getMetadata('mcpkit:tools', target) ?? [];
    const resources = Reflect.getMetadata('mcpkit:resources', target) ?? [];
    const prompts = Reflect.getMetadata('mcpkit:prompts', target) ?? [];

    let operationType: 'tool' | 'resource' | 'prompt' = 'tool';
    let operationName = String(propertyKey);

    const toolMeta = tools.find(
      (t: { propertyKey: string | symbol }) => t.propertyKey === propertyKey,
    );
    const resourceMeta = resources.find(
      (r: { propertyKey: string | symbol }) => r.propertyKey === propertyKey,
    );
    const promptMeta = prompts.find(
      (p: { propertyKey: string | symbol }) => p.propertyKey === propertyKey,
    );

    if (toolMeta) {
      operationType = 'tool';
      operationName = toolMeta.name ?? operationName;
    } else if (resourceMeta) {
      operationType = 'resource';
      operationName = resourceMeta.name ?? operationName;
    } else if (promptMeta) {
      operationType = 'prompt';
      operationName = promptMeta.name ?? operationName;
    }

    const originalMethod = descriptor.value;

    if (typeof originalMethod === 'function') {
      descriptor.value = createDebugWrapper(originalMethod, options, {
        type: operationType,
        name: operationName,
        method: String(propertyKey),
      });
    }
  };
}

/**
 * Get debug options for a method
 */
export function getDebugOptions(
  target: object,
  propertyKey: string | symbol,
): DebugOptions | undefined {
  const key = `${DEBUG_KEY.toString()}:${String(propertyKey)}`;
  return Reflect.getMetadata(key, target);
}

/**
 * Check if debug is enabled for a method
 */
export function isDebugEnabled(target: object, propertyKey: string | symbol): boolean {
  const options = getDebugOptions(target, propertyKey);
  if (!options) {
    return globalDebugConfig.enabled ?? false;
  }
  return options.enabled ?? globalDebugConfig.enabled ?? false;
}
