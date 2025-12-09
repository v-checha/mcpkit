import type { ToolResult, ToolResultContent } from '../types/index.js';

/**
 * Format any tool return value into MCP-compatible ToolResult
 */
export function formatToolResult(result: unknown): ToolResult {
  // Handle null/undefined
  if (result === null || result === undefined) {
    return {
      content: [{ type: 'text', text: '' }],
    };
  }

  // Handle string results
  if (typeof result === 'string') {
    return {
      content: [{ type: 'text', text: result }],
    };
  }

  // Handle number/boolean primitives
  if (typeof result === 'number' || typeof result === 'boolean') {
    return {
      content: [{ type: 'text', text: String(result) }],
    };
  }

  // Handle arrays - could be content array or data array
  if (Array.isArray(result)) {
    // Check if it looks like a content array
    if (isContentArray(result)) {
      return { content: result as ToolResultContent[] };
    }
    // Otherwise serialize as JSON
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  // Handle objects
  if (typeof result === 'object') {
    // Check if it's already a ToolResult
    if (isToolResult(result)) {
      return result;
    }
    // Serialize as JSON
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  // Fallback - convert to string
  return {
    content: [{ type: 'text', text: String(result) }],
  };
}

/**
 * Check if value is a valid ToolResult
 */
function isToolResult(value: unknown): value is ToolResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.content) && isContentArray(obj.content);
}

/**
 * Check if array is a valid content array
 */
function isContentArray(arr: unknown[]): arr is ToolResultContent[] {
  return arr.every((item) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return obj.type === 'text' || obj.type === 'image' || obj.type === 'resource';
  });
}

/**
 * Format error into MCP-compatible error result
 */
export function formatToolError(error: unknown): ToolResult {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Unknown error occurred';
  }

  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
