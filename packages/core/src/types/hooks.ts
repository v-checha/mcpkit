/**
 * Context provided to tool call hooks
 */
export interface ToolCallContext {
  /** Name of the tool being called */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Timestamp when the call started */
  timestamp: number;
}

/**
 * Context provided to successful tool completion hooks
 */
export interface ToolSuccessContext extends ToolCallContext {
  /** Result returned by the tool */
  result: unknown;
  /** Duration of execution in milliseconds */
  duration: number;
}

/**
 * Context provided to tool error hooks
 */
export interface ToolErrorContext extends ToolCallContext {
  /** Error that occurred */
  error: Error;
  /** Duration until error in milliseconds */
  duration: number;
}

/**
 * Context provided to resource read hooks
 */
export interface ResourceReadContext {
  /** URI of the resource */
  uri: string;
  /** Timestamp when the read started */
  timestamp: number;
}

/**
 * Context provided to successful resource read hooks
 */
export interface ResourceSuccessContext extends ResourceReadContext {
  /** Duration of read in milliseconds */
  duration: number;
}

/**
 * Context provided to resource error hooks
 */
export interface ResourceErrorContext extends ResourceReadContext {
  /** Error that occurred */
  error: Error;
  /** Duration until error in milliseconds */
  duration: number;
}

/**
 * Context provided to prompt get hooks
 */
export interface PromptGetContext {
  /** Name of the prompt */
  promptName: string;
  /** Arguments passed to the prompt */
  args?: Record<string, string>;
  /** Timestamp when the get started */
  timestamp: number;
}

/**
 * Context provided to successful prompt get hooks
 */
export interface PromptSuccessContext extends PromptGetContext {
  /** Duration of execution in milliseconds */
  duration: number;
}

/**
 * Context provided to prompt error hooks
 */
export interface PromptErrorContext extends PromptGetContext {
  /** Error that occurred */
  error: Error;
  /** Duration until error in milliseconds */
  duration: number;
}

/**
 * Server lifecycle and monitoring hooks
 */
export interface ServerHooks {
  /**
   * Whether to await hook execution before continuing.
   * - `true` (default): Wait for hooks to complete before continuing
   * - `false`: Fire-and-forget for better performance
   * @default true
   */
  awaitHooks?: boolean;

  /**
   * Called when the server starts
   */
  onServerStart?: () => void | Promise<void>;

  /**
   * Called when the server stops
   */
  onServerStop?: () => void | Promise<void>;

  /**
   * Called before a tool is executed
   */
  onToolCall?: (context: ToolCallContext) => void | Promise<void>;

  /**
   * Called after a tool completes successfully
   */
  onToolSuccess?: (context: ToolSuccessContext) => void | Promise<void>;

  /**
   * Called when a tool throws an error
   */
  onToolError?: (context: ToolErrorContext) => void | Promise<void>;

  /**
   * Called before a resource is read
   */
  onResourceRead?: (context: ResourceReadContext) => void | Promise<void>;

  /**
   * Called after a resource is read successfully
   */
  onResourceSuccess?: (context: ResourceSuccessContext) => void | Promise<void>;

  /**
   * Called when a resource read fails
   */
  onResourceError?: (context: ResourceErrorContext) => void | Promise<void>;

  /**
   * Called before a prompt is retrieved
   */
  onPromptGet?: (context: PromptGetContext) => void | Promise<void>;

  /**
   * Called after a prompt is retrieved successfully
   */
  onPromptSuccess?: (context: PromptSuccessContext) => void | Promise<void>;

  /**
   * Called when a prompt retrieval fails
   */
  onPromptError?: (context: PromptErrorContext) => void | Promise<void>;
}

/**
 * Logger function type for @Monitor decorator
 */
export type MonitorLogger = (message: string, data?: Record<string, unknown>) => void;

/**
 * Options for the @Monitor decorator
 */
export interface MonitorOptions {
  /**
   * Log input arguments
   * @default false
   */
  logArgs?: boolean;

  /**
   * Log return value
   * @default false
   */
  logResult?: boolean;

  /**
   * Log execution duration
   * @default true
   */
  logDuration?: boolean;

  /**
   * Log errors
   * @default true
   */
  logErrors?: boolean;

  /**
   * Custom logger function
   * @default console.error (use stderr to avoid breaking stdio transport)
   */
  logger?: MonitorLogger;

  /**
   * Custom error logger function
   * @default console.error
   */
  errorLogger?: MonitorLogger;
}
