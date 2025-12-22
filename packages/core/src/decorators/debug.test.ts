import 'reflect-metadata';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  Debug,
  configureDebug,
  getDebugConfig,
  getDebugOptions,
  isDebugEnabled,
  type DebugLogger,
  type DebugLevel,
} from './debug.js';
import { MCPServer } from './server.js';
import { Tool } from './tool.js';
import { Param } from './param.js';

describe('@Debug decorator', () => {
  let mockLogger: DebugLogger;
  let logCalls: Array<{ level: DebugLevel; message: string; data?: Record<string, unknown> }>;

  beforeEach(() => {
    logCalls = [];
    mockLogger = {
      log: (level, message, data) => {
        logCalls.push({ level, message, data });
      },
    };

    // Enable debug globally for tests
    configureDebug({ enabled: true, logger: mockLogger });
  });

  afterEach(() => {
    // Reset to default
    configureDebug({ enabled: false, logger: undefined });
  });

  describe('configureDebug', () => {
    it('should configure global debug settings', () => {
      configureDebug({ level: 'info', logArgs: false });

      const config = getDebugConfig();
      expect(config.level).toBe('info');
      expect(config.logArgs).toBe(false);
    });

    it('should merge with existing config', () => {
      configureDebug({ level: 'debug' });
      configureDebug({ logResult: false });

      const config = getDebugConfig();
      expect(config.level).toBe('debug');
      expect(config.logResult).toBe(false);
    });
  });

  describe('Debug decorator application', () => {
    @MCPServer({ name: 'debug-test', version: '1.0.0' })
    class DebugTestServer {
      @Tool({ description: 'Test tool' })
      @Debug({ enabled: true, logger: undefined })
      async testTool(@Param({ name: 'input' }) input: string) {
        return `Result: ${input}`;
      }

      @Tool({ description: 'Slow tool' })
      @Debug({ enabled: true, logDuration: true })
      async slowTool() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      }

      @Tool({ description: 'Error tool' })
      @Debug({ enabled: true })
      async errorTool() {
        throw new Error('Test error');
      }
    }

    it('should store debug options in metadata', () => {
      const server = new DebugTestServer();
      const options = getDebugOptions(server, 'testTool');

      expect(options).toBeDefined();
      expect(options?.enabled).toBe(true);
    });

    it('should check if debug is enabled', () => {
      const server = new DebugTestServer();

      expect(isDebugEnabled(server, 'testTool')).toBe(true);
    });
  });

  describe('Debug logging behavior', () => {
    it('should log entry and exit for method calls', async () => {
      @MCPServer({ name: 'log-test', version: '1.0.0' })
      class LogTestServer {
        @Tool({ description: 'Logged tool' })
        @Debug({ enabled: true, logger: mockLogger })
        async loggedTool(@Param({ name: 'value' }) value: string) {
          return value.toUpperCase();
        }
      }

      const server = new LogTestServer();
      await server.loggedTool('hello');

      // Should have entry and exit logs
      expect(logCalls.length).toBeGreaterThanOrEqual(2);
      expect(logCalls.some((c) => c.message.includes('→'))).toBe(true);
      expect(logCalls.some((c) => c.message.includes('←'))).toBe(true);
    });

    it('should log errors', async () => {
      @MCPServer({ name: 'error-test', version: '1.0.0' })
      class ErrorTestServer {
        @Tool({ description: 'Error tool' })
        @Debug({ enabled: true, logger: mockLogger })
        async failingTool() {
          throw new Error('Intentional error');
        }
      }

      const server = new ErrorTestServer();

      await expect(server.failingTool()).rejects.toThrow('Intentional error');

      // Should have error log
      expect(logCalls.some((c) => c.level === 'error')).toBe(true);
    });

    it('should sanitize sensitive data', async () => {
      @MCPServer({ name: 'sanitize-test', version: '1.0.0' })
      class SanitizeTestServer {
        @Tool({ description: 'Sensitive tool' })
        @Debug({
          enabled: true,
          logger: mockLogger,
          sanitize: (key, value) => {
            if (key.includes('password') || key.includes('token')) {
              return '[REDACTED]';
            }
            return value;
          },
        })
        async sensitiveOp(@Param({ name: 'password' }) password: string) {
          return 'success';
        }
      }

      const server = new SanitizeTestServer();
      await server.sensitiveOp('secret123');

      // Check that password is not in logs
      const logContent = JSON.stringify(logCalls);
      expect(logContent).not.toContain('secret123');
    });

    it('should respect log level', async () => {
      const traceLogs: string[] = [];
      const traceLogger: DebugLogger = {
        log: (level, message) => {
          if (level === 'trace') traceLogs.push(message);
        },
      };

      @MCPServer({ name: 'level-test', version: '1.0.0' })
      class LevelTestServer {
        @Tool({ description: 'Level tool' })
        @Debug({ enabled: true, level: 'info', logger: traceLogger })
        async levelTool() {
          return 'ok';
        }
      }

      const server = new LevelTestServer();
      await server.levelTool();

      // Trace logs should be filtered out when level is info
      expect(traceLogs).toHaveLength(0);
    });
  });

  describe('Debug disabled', () => {
    it('should not log when disabled', async () => {
      @MCPServer({ name: 'disabled-test', version: '1.0.0' })
      class DisabledTestServer {
        @Tool({ description: 'Disabled debug tool' })
        @Debug({ enabled: false, logger: mockLogger })
        async disabledTool() {
          return 'result';
        }
      }

      const server = new DisabledTestServer();
      await server.disabledTool();

      expect(logCalls).toHaveLength(0);
    });

    it('should respect global config when not overridden', async () => {
      configureDebug({ enabled: false });

      @MCPServer({ name: 'global-test', version: '1.0.0' })
      class GlobalTestServer {
        @Tool({ description: 'Global debug tool' })
        @Debug({ logger: mockLogger }) // No enabled override
        async globalTool() {
          return 'result';
        }
      }

      const server = new GlobalTestServer();
      await server.globalTool();

      expect(logCalls).toHaveLength(0);
    });
  });
});
