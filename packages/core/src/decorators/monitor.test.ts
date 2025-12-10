import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { MetadataStorage } from '../metadata/index.js';
import { Monitor } from './monitor.js';
import { Tool } from './tool.js';

describe('@Monitor Decorator', () => {
  it('should store monitor options on method', () => {
    class TestServer {
      @Tool({ description: 'Test tool' })
      @Monitor({ logArgs: true, logResult: true })
      async testMethod() {
        return 'result';
      }
    }

    const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testMethod');

    expect(monitorOpts).toBeDefined();
    expect(monitorOpts?.logArgs).toBe(true);
    expect(monitorOpts?.logResult).toBe(true);
  });

  it('should apply default values for unspecified options', () => {
    class TestServer {
      @Monitor()
      async testMethod() {
        return 'result';
      }
    }

    const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testMethod');

    expect(monitorOpts).toBeDefined();
    expect(monitorOpts?.logArgs).toBe(false);
    expect(monitorOpts?.logResult).toBe(false);
    expect(monitorOpts?.logDuration).toBe(true);
    expect(monitorOpts?.logErrors).toBe(true);
  });

  it('should allow custom logger functions', () => {
    const customLogger = (message: string, data?: Record<string, unknown>) => {
      // Custom logger implementation
    };

    class TestServer {
      @Monitor({ logger: customLogger })
      async testMethod() {
        return 'result';
      }
    }

    const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testMethod');

    expect(monitorOpts?.logger).toBe(customLogger);
  });

  it('should allow custom error logger', () => {
    const customErrorLogger = (message: string, data?: Record<string, unknown>) => {
      // Custom error logger implementation
    };

    class TestServer {
      @Monitor({ errorLogger: customErrorLogger })
      async testMethod() {
        return 'result';
      }
    }

    const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testMethod');

    expect(monitorOpts?.errorLogger).toBe(customErrorLogger);
  });

  it('should return undefined for methods without @Monitor', () => {
    class TestServer {
      @Tool({ description: 'Test' })
      async testMethod() {
        return 'result';
      }
    }

    const monitorOpts = MetadataStorage.getMonitorOptions(TestServer.prototype, 'testMethod');

    expect(monitorOpts).toBeUndefined();
  });

  it('should work with @Tool decorator in any order', () => {
    // @Monitor before @Tool
    class TestServer1 {
      @Monitor({ logArgs: true })
      @Tool({ description: 'Test' })
      async method1() {
        return 'result';
      }
    }

    // @Tool before @Monitor
    class TestServer2 {
      @Tool({ description: 'Test' })
      @Monitor({ logResult: true })
      async method2() {
        return 'result';
      }
    }

    const opts1 = MetadataStorage.getMonitorOptions(TestServer1.prototype, 'method1');
    const opts2 = MetadataStorage.getMonitorOptions(TestServer2.prototype, 'method2');

    expect(opts1?.logArgs).toBe(true);
    expect(opts2?.logResult).toBe(true);
  });
});
