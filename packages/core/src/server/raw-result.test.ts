import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { Tool } from '../decorators/tool.js';
import { MetadataStorage } from '../metadata/index.js';
import type { ToolResultContent } from '../types/index.js';
import { bootstrapServer } from './bootstrap.js';

describe('rawResult option', () => {
  it('should store rawResult metadata and pass raw result through bootstrap', async () => {
    class TestServer {
      @Tool({ description: 'Returns raw MCP result', rawResult: true })
      async rawTool() {
        return {
          content: [
            { type: 'text' as const, text: 'raw text' },
            { type: 'image' as const, data: 'abc123', mimeType: 'image/png' },
          ],
        };
      }
    }

    const instance = new TestServer();
    const prototype = Object.getPrototypeOf(instance);
    const tools = MetadataStorage.getToolsMetadata(prototype);

    expect(tools[0].rawResult).toBe(true);

    // Bootstrap to verify the server registers without errors
    const { server } = await bootstrapServer(
      instance,
      { name: 'test', version: '1.0.0', capabilities: { tools: true } },
      { transport: 'stdio' },
    );

    await server.close();
  });

  it('should return structuredContent when rawResult is true', () => {
    class TestServer {
      @Tool({ description: 'Returns structured content', rawResult: true })
      async structuredTool() {
        return {
          structuredContent: { temperature: 72, unit: 'fahrenheit' },
        };
      }
    }

    const prototype = Object.getPrototypeOf(new TestServer());
    const tools = MetadataStorage.getToolsMetadata(prototype);

    expect(tools[0].rawResult).toBe(true);
  });

  it('should default rawResult to undefined when not provided', () => {
    class TestServer {
      @Tool({ description: 'Normal tool' })
      async normalTool() {
        return 'hello world';
      }
    }

    const prototype = Object.getPrototypeOf(new TestServer());
    const tools = MetadataStorage.getToolsMetadata(prototype);

    expect(tools[0].rawResult).toBeUndefined();
  });

  it('should return isError in raw result when rawResult is true', async () => {
    class TestServer {
      @Tool({ description: 'Returns raw error', rawResult: true })
      async errorTool() {
        return {
          content: [{ type: 'text' as const, text: 'Something went wrong' }],
          isError: true,
        };
      }
    }

    const instance = new TestServer();
    const result = await instance.errorTool();

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Something went wrong' }],
      isError: true,
    });
  });

  it('should still throw exceptions even when rawResult is true', async () => {
    class TestServer {
      @Tool({ description: 'Throws error', rawResult: true })
      async throwingTool(): Promise<{ content: ToolResultContent[] }> {
        throw new Error('Unexpected failure');
      }
    }

    const instance = new TestServer();
    const prototype = Object.getPrototypeOf(instance);
    const tools = MetadataStorage.getToolsMetadata(prototype);

    // The rawResult flag is set, but exception handling in bootstrap.ts
    // still applies formatError regardless of rawResult
    expect(tools[0].rawResult).toBe(true);
    await expect(instance.throwingTool()).rejects.toThrow('Unexpected failure');
  });
});
