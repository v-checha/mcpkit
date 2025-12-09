import { describe, expect, it } from 'vitest';
import { formatToolError, formatToolResult } from './result-formatter.js';

describe('Result Formatter', () => {
  describe('formatToolResult', () => {
    it('should format string result', () => {
      const result = formatToolResult('Hello, world!');

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello, world!' }],
      });
    });

    it('should format number result', () => {
      const result = formatToolResult(42);

      expect(result).toEqual({
        content: [{ type: 'text', text: '42' }],
      });
    });

    it('should format boolean result', () => {
      const result = formatToolResult(true);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'true' }],
      });
    });

    it('should format null result', () => {
      const result = formatToolResult(null);

      expect(result).toEqual({
        content: [{ type: 'text', text: '' }],
      });
    });

    it('should format undefined result', () => {
      const result = formatToolResult(undefined);

      expect(result).toEqual({
        content: [{ type: 'text', text: '' }],
      });
    });

    it('should format object result as JSON', () => {
      const obj = { name: 'test', count: 42 };
      const result = formatToolResult(obj);

      expect(result.content[0].type).toBe('text');
      expect(JSON.parse((result.content[0] as any).text)).toEqual(obj);
    });

    it('should format array result as JSON', () => {
      const arr = [1, 2, 3];
      const result = formatToolResult(arr);

      expect(result.content[0].type).toBe('text');
      expect(JSON.parse((result.content[0] as any).text)).toEqual(arr);
    });

    it('should pass through valid ToolResult', () => {
      const toolResult = {
        content: [{ type: 'text' as const, text: 'Already formatted' }],
      };
      const result = formatToolResult(toolResult);

      expect(result).toEqual(toolResult);
    });

    it('should pass through content array', () => {
      const content = [
        { type: 'text' as const, text: 'First' },
        { type: 'text' as const, text: 'Second' },
      ];
      const result = formatToolResult(content);

      expect(result).toEqual({ content });
    });
  });

  describe('formatToolError', () => {
    it('should format Error object', () => {
      const error = new Error('Something went wrong');
      const result = formatToolError(error);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Something went wrong' }],
        isError: true,
      });
    });

    it('should format string error', () => {
      const result = formatToolError('String error message');

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: String error message' }],
        isError: true,
      });
    });

    it('should handle unknown error type', () => {
      const result = formatToolError({ some: 'object' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Unknown error occurred' }],
        isError: true,
      });
    });

    it('should always set isError to true', () => {
      const result = formatToolError('any error');

      expect(result.isError).toBe(true);
    });
  });
});
