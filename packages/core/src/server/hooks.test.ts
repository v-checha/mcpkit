import { describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { Monitor } from '../decorators/monitor.js';
import { Param } from '../decorators/param.js';
import { MCPServer } from '../decorators/server.js';
import { Tool } from '../decorators/tool.js';
import { MetadataStorage } from '../metadata/index.js';
import type {
  ServerHooks,
  ToolCallContext,
  ToolErrorContext,
  ToolSuccessContext,
} from '../types/hooks.js';

describe('Server Hooks', () => {
  describe('@MCPServer hooks option', () => {
    it('should store hooks in server metadata', () => {
      const hooks: ServerHooks = {
        onToolCall: vi.fn(),
        onToolSuccess: vi.fn(),
      };

      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        hooks,
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      expect(options?.hooks).toBeDefined();
      expect(options?.hooks?.onToolCall).toBe(hooks.onToolCall);
      expect(options?.hooks?.onToolSuccess).toBe(hooks.onToolSuccess);
    });

    it('should store awaitHooks option', () => {
      const hooks: ServerHooks = {
        awaitHooks: false,
        onToolCall: vi.fn(),
      };

      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        hooks,
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      expect(options?.hooks?.awaitHooks).toBe(false);
    });

    it('should work without hooks', () => {
      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      expect(options?.hooks).toBeUndefined();
    });
  });

  describe('Hook context types', () => {
    it('should accept properly typed tool call context', () => {
      const onToolCall = (ctx: ToolCallContext) => {
        expect(typeof ctx.toolName).toBe('string');
        expect(typeof ctx.args).toBe('object');
        expect(typeof ctx.timestamp).toBe('number');
      };

      const context: ToolCallContext = {
        toolName: 'testTool',
        args: { param: 'value' },
        timestamp: Date.now(),
      };

      onToolCall(context);
    });

    it('should accept properly typed tool success context', () => {
      const onToolSuccess = (ctx: ToolSuccessContext) => {
        expect(typeof ctx.toolName).toBe('string');
        expect(typeof ctx.args).toBe('object');
        expect(typeof ctx.timestamp).toBe('number');
        expect(typeof ctx.duration).toBe('number');
        expect(ctx.result).toBeDefined();
      };

      const context: ToolSuccessContext = {
        toolName: 'testTool',
        args: { param: 'value' },
        timestamp: Date.now(),
        result: 'success',
        duration: 100,
      };

      onToolSuccess(context);
    });

    it('should accept properly typed tool error context', () => {
      const onToolError = (ctx: ToolErrorContext) => {
        expect(typeof ctx.toolName).toBe('string');
        expect(typeof ctx.args).toBe('object');
        expect(typeof ctx.timestamp).toBe('number');
        expect(typeof ctx.duration).toBe('number');
        expect(ctx.error).toBeInstanceOf(Error);
      };

      const context: ToolErrorContext = {
        toolName: 'testTool',
        args: { param: 'value' },
        timestamp: Date.now(),
        error: new Error('test error'),
        duration: 50,
      };

      onToolError(context);
    });
  });

  describe('@Monitor with hooks', () => {
    it('should store monitor options when hooks are configured', () => {
      const hooks: ServerHooks = {
        onToolCall: vi.fn(),
      };

      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        hooks,
      })
      class TestServer {
        @Tool({ description: 'Test tool' })
        @Monitor({ logArgs: true, logDuration: true })
        async testTool(@Param({ name: 'data' }) data: string) {
          return `Processed: ${data}`;
        }
      }

      const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testTool');

      expect(monitorOpts).toBeDefined();
      expect(monitorOpts?.logArgs).toBe(true);
      expect(monitorOpts?.logDuration).toBe(true);
    });
  });

  describe('Async hook handling', () => {
    it('should allow async hooks', async () => {
      let hookCalled = false;

      const hooks: ServerHooks = {
        onToolCall: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          hookCalled = true;
        },
      };

      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        hooks,
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      // Simulate calling the hook
      await options?.hooks?.onToolCall?.({
        toolName: 'test',
        args: {},
        timestamp: Date.now(),
      });

      expect(hookCalled).toBe(true);
    });

    it('should allow sync hooks', () => {
      let hookCalled = false;

      const hooks: ServerHooks = {
        onToolCall: () => {
          hookCalled = true;
        },
      };

      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        hooks,
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      // Simulate calling the hook
      options?.hooks?.onToolCall?.({
        toolName: 'test',
        args: {},
        timestamp: Date.now(),
      });

      expect(hookCalled).toBe(true);
    });
  });

  describe('All hook types', () => {
    it('should support all server lifecycle hooks', () => {
      const hooks: ServerHooks = {
        awaitHooks: true,
        onServerStart: vi.fn(),
        onServerStop: vi.fn(),
        onToolCall: vi.fn(),
        onToolSuccess: vi.fn(),
        onToolError: vi.fn(),
        onResourceRead: vi.fn(),
        onResourceSuccess: vi.fn(),
        onResourceError: vi.fn(),
        onPromptGet: vi.fn(),
        onPromptSuccess: vi.fn(),
        onPromptError: vi.fn(),
      };

      @MCPServer({
        name: 'full-hooks-server',
        version: '1.0.0',
        hooks,
      })
      class FullHooksServer {}

      const options = MetadataStorage.getServerOptions(FullHooksServer);

      expect(options?.hooks?.onServerStart).toBeDefined();
      expect(options?.hooks?.onServerStop).toBeDefined();
      expect(options?.hooks?.onToolCall).toBeDefined();
      expect(options?.hooks?.onToolSuccess).toBeDefined();
      expect(options?.hooks?.onToolError).toBeDefined();
      expect(options?.hooks?.onResourceRead).toBeDefined();
      expect(options?.hooks?.onResourceSuccess).toBeDefined();
      expect(options?.hooks?.onResourceError).toBeDefined();
      expect(options?.hooks?.onPromptGet).toBeDefined();
      expect(options?.hooks?.onPromptSuccess).toBeDefined();
      expect(options?.hooks?.onPromptError).toBeDefined();
    });
  });
});
