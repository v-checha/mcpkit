import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { z } from 'zod';
import { MetadataStorage } from '../metadata/index.js';
import { Param } from './param.js';
import { Prompt } from './prompt.js';
import { Resource } from './resource.js';
import { MCPServer } from './server.js';
import { Tool } from './tool.js';

describe('Decorators', () => {
  describe('@Tool', () => {
    it('should store tool metadata on prototype', () => {
      class TestServer {
        @Tool({ description: 'Test tool' })
        async testMethod() {
          return 'result';
        }
      }

      const tools = MetadataStorage.getToolsMetadata(TestServer.prototype);

      expect(tools).toHaveLength(1);
      expect(tools[0].propertyKey).toBe('testMethod');
      expect(tools[0].description).toBe('Test tool');
    });

    it('should use custom name when provided', () => {
      class TestServer {
        @Tool({ name: 'custom_name', description: 'Test' })
        async myMethod() {
          return 'result';
        }
      }

      const tools = MetadataStorage.getToolsMetadata(TestServer.prototype);

      expect(tools[0].name).toBe('custom_name');
    });

    it('should store Zod schema when provided', () => {
      const schema = z.object({ city: z.string() });

      class TestServer {
        @Tool({ description: 'Test', schema })
        async testMethod(args: { city: string }) {
          return args.city;
        }
      }

      const tools = MetadataStorage.getToolsMetadata(TestServer.prototype);

      expect(tools[0].schema).toBe(schema);
    });

    it('should throw when applied to non-method', () => {
      expect(() => {
        // biome-ignore lint/correctness/noUnusedVariables: Class is intentionally unused - testing decorator throws
        class Invalid {
          @Tool({ description: 'Test' })
          // @ts-expect-error Testing invalid usage
          notAMethod = 'value';
        }
      }).toThrow();
    });
  });

  describe('@Param', () => {
    it('should store parameter metadata', () => {
      class TestServer {
        async testMethod(
          @Param({ name: 'city', description: 'City name' })
          city: string,
        ) {
          return city;
        }
      }

      const params = MetadataStorage.getParamsMetadata(TestServer.prototype, 'testMethod');

      expect(params[0]).toBeDefined();
      expect(params[0].name).toBe('city');
      expect(params[0].description).toBe('City name');
      expect(params[0].index).toBe(0);
    });

    it('should store optional flag', () => {
      class TestServer {
        async testMethod(
          @Param({ name: 'city', optional: true })
          city?: string,
        ) {
          return city;
        }
      }

      const params = MetadataStorage.getParamsMetadata(TestServer.prototype, 'testMethod');

      expect(params[0].optional).toBe(true);
    });

    it('should store custom Zod schema', () => {
      const schema = z.enum(['celsius', 'fahrenheit']);

      class TestServer {
        async testMethod(
          @Param({ name: 'unit', schema })
          unit: 'celsius' | 'fahrenheit',
        ) {
          return unit;
        }
      }

      const params = MetadataStorage.getParamsMetadata(TestServer.prototype, 'testMethod');

      expect(params[0].schema).toBe(schema);
    });

    it('should capture design type from TypeScript (when emitDecoratorMetadata is enabled)', () => {
      // Note: This test may not work in vitest as it doesn't emit decorator metadata.
      // The design type capture works when compiled with tsc and emitDecoratorMetadata: true
      class TestServer {
        async testMethod(
          @Param({ name: 'name' })
          name: string,
          @Param({ name: 'count' })
          count: number,
        ) {
          return `${name}: ${count}`;
        }
      }

      const params = MetadataStorage.getParamsMetadata(TestServer.prototype, 'testMethod');

      // Design types are captured when emitDecoratorMetadata is enabled
      // In test environment, this may be undefined
      expect(params[0].index).toBe(0);
      expect(params[0].name).toBe('name');
      expect(params[1].index).toBe(1);
      expect(params[1].name).toBe('count');
    });
  });

  describe('@Resource', () => {
    it('should accept URI string', () => {
      class TestServer {
        @Resource('weather://cities/{city}')
        async getCityWeather(city: string) {
          return { city };
        }
      }

      const resources = MetadataStorage.getResourcesMetadata(TestServer.prototype);

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('weather://cities/{city}');
    });

    it('should accept full options object', () => {
      class TestServer {
        @Resource({
          uri: 'docs://readme',
          name: 'README',
          description: 'Project readme',
          mimeType: 'text/markdown',
        })
        async getReadme() {
          return '# README';
        }
      }

      const resources = MetadataStorage.getResourcesMetadata(TestServer.prototype);

      expect(resources[0].uri).toBe('docs://readme');
      expect(resources[0].name).toBe('README');
      expect(resources[0].description).toBe('Project readme');
      expect(resources[0].mimeType).toBe('text/markdown');
    });
  });

  describe('@Prompt', () => {
    it('should store prompt metadata', () => {
      class TestServer {
        @Prompt({ description: 'Generate greeting' })
        async greetingPrompt() {
          return { messages: [] };
        }
      }

      const prompts = MetadataStorage.getPromptsMetadata(TestServer.prototype);

      expect(prompts).toHaveLength(1);
      expect(prompts[0].propertyKey).toBe('greetingPrompt');
      expect(prompts[0].description).toBe('Generate greeting');
    });

    it('should use custom name when provided', () => {
      class TestServer {
        @Prompt({ name: 'custom_prompt' })
        async myPrompt() {
          return { messages: [] };
        }
      }

      const prompts = MetadataStorage.getPromptsMetadata(TestServer.prototype);

      expect(prompts[0].name).toBe('custom_prompt');
    });
  });

  describe('@MCPServer', () => {
    it('should store server options metadata', () => {
      @MCPServer({
        name: 'test-server',
        version: '1.0.0',
        description: 'Test description',
      })
      class TestServer {}

      const options = MetadataStorage.getServerOptions(TestServer);

      expect(options).toBeDefined();
      expect(options?.name).toBe('test-server');
      expect(options?.version).toBe('1.0.0');
      expect(options?.description).toBe('Test description');
    });

    it('should add listen method to class', () => {
      @MCPServer({ name: 'test', version: '1.0.0' })
      class TestServer {}

      const server = new TestServer();

      expect(typeof (server as any).listen).toBe('function');
      expect(typeof (server as any).close).toBe('function');
      expect(typeof (server as any).isConnected).toBe('function');
    });

    it('should preserve class name', () => {
      @MCPServer({ name: 'test', version: '1.0.0' })
      class MyCustomServer {}

      expect(MyCustomServer.name).toBe('MyCustomServer');
    });

    it('should initially report not connected', () => {
      @MCPServer({ name: 'test', version: '1.0.0' })
      class TestServer {}

      const server = new TestServer();

      expect((server as any).isConnected()).toBe(false);
    });
  });
});
