/**
 * Base error class for MCPKit errors
 */
export class MCPKitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'MCPKitError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a decorator is used incorrectly
 */
export class DecoratorError extends MCPKitError {
  constructor(message: string) {
    super(message, 'DECORATOR_ERROR');
    this.name = 'DecoratorError';
  }
}

/**
 * Error thrown during schema generation or validation
 */
export class SchemaError extends MCPKitError {
  constructor(message: string) {
    super(message, 'SCHEMA_ERROR');
    this.name = 'SchemaError';
  }
}

/**
 * Error thrown during server bootstrap
 */
export class BootstrapError extends MCPKitError {
  constructor(message: string) {
    super(message, 'BOOTSTRAP_ERROR');
    this.name = 'BootstrapError';
  }
}

/**
 * Error thrown during tool execution
 */
export class ToolExecutionError extends MCPKitError {
  constructor(
    message: string,
    public readonly toolName: string,
  ) {
    super(message, 'TOOL_EXECUTION_ERROR');
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error thrown when transport fails
 */
export class TransportError extends MCPKitError {
  constructor(message: string) {
    super(message, 'TRANSPORT_ERROR');
    this.name = 'TransportError';
  }
}
