import { beforeEach, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { MetadataStorage, type ParamMetadata, type ToolMetadata } from './storage.js';

describe('MetadataStorage', () => {
  // Create fresh class for each test to avoid metadata leaking
  let TestClass: new () => object;

  beforeEach(() => {
    TestClass = class TestClass {};
  });

  describe('Server Options', () => {
    it('should store and retrieve server options', () => {
      const options = {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server',
      };

      MetadataStorage.setServerOptions(TestClass, options);
      const retrieved = MetadataStorage.getServerOptions(TestClass);

      expect(retrieved).toEqual(options);
    });

    it('should return undefined for class without options', () => {
      class EmptyClass {}
      const retrieved = MetadataStorage.getServerOptions(EmptyClass);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Tool Metadata', () => {
    it('should store and retrieve tool metadata', () => {
      const toolMeta: ToolMetadata = {
        propertyKey: 'testMethod',
        name: 'test_tool',
        description: 'A test tool',
      };

      MetadataStorage.addToolMetadata(TestClass.prototype, toolMeta);
      const tools = MetadataStorage.getToolsMetadata(TestClass.prototype);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual(toolMeta);
    });

    it('should accumulate multiple tools', () => {
      const tool1: ToolMetadata = { propertyKey: 'method1' };
      const tool2: ToolMetadata = { propertyKey: 'method2' };

      MetadataStorage.addToolMetadata(TestClass.prototype, tool1);
      MetadataStorage.addToolMetadata(TestClass.prototype, tool2);
      const tools = MetadataStorage.getToolsMetadata(TestClass.prototype);

      expect(tools).toHaveLength(2);
    });

    it('should return empty array for class without tools', () => {
      const tools = MetadataStorage.getToolsMetadata(TestClass.prototype);
      expect(tools).toEqual([]);
    });
  });

  describe('Resource Metadata', () => {
    it('should store and retrieve resource metadata', () => {
      const resourceMeta = {
        propertyKey: 'getResource',
        uri: 'test://resource/{id}',
        name: 'Test Resource',
      };

      MetadataStorage.addResourceMetadata(TestClass.prototype, resourceMeta);
      const resources = MetadataStorage.getResourcesMetadata(TestClass.prototype);

      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual(resourceMeta);
    });
  });

  describe('Prompt Metadata', () => {
    it('should store and retrieve prompt metadata', () => {
      const promptMeta = {
        propertyKey: 'generatePrompt',
        name: 'test_prompt',
        description: 'A test prompt',
      };

      MetadataStorage.addPromptMetadata(TestClass.prototype, promptMeta);
      const prompts = MetadataStorage.getPromptsMetadata(TestClass.prototype);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toEqual(promptMeta);
    });
  });

  describe('Parameter Metadata', () => {
    it('should store and retrieve parameter metadata', () => {
      const param: ParamMetadata = {
        index: 0,
        name: 'city',
        description: 'City name',
        optional: false,
      };

      MetadataStorage.addParamMetadata(TestClass.prototype, 'testMethod', param);
      const params = MetadataStorage.getParamsMetadata(TestClass.prototype, 'testMethod');

      expect(params[0]).toEqual(param);
    });

    it('should store multiple parameters in correct positions', () => {
      const param0: ParamMetadata = { index: 0, name: 'first' };
      const param1: ParamMetadata = { index: 1, name: 'second' };
      const param2: ParamMetadata = { index: 2, name: 'third' };

      // Add out of order
      MetadataStorage.addParamMetadata(TestClass.prototype, 'method', param2);
      MetadataStorage.addParamMetadata(TestClass.prototype, 'method', param0);
      MetadataStorage.addParamMetadata(TestClass.prototype, 'method', param1);

      const params = MetadataStorage.getParamsMetadata(TestClass.prototype, 'method');

      expect(params[0]).toEqual(param0);
      expect(params[1]).toEqual(param1);
      expect(params[2]).toEqual(param2);
    });

    it('should keep parameters separate per method', () => {
      const param1: ParamMetadata = { index: 0, name: 'param1' };
      const param2: ParamMetadata = { index: 0, name: 'param2' };

      MetadataStorage.addParamMetadata(TestClass.prototype, 'method1', param1);
      MetadataStorage.addParamMetadata(TestClass.prototype, 'method2', param2);

      const params1 = MetadataStorage.getParamsMetadata(TestClass.prototype, 'method1');
      const params2 = MetadataStorage.getParamsMetadata(TestClass.prototype, 'method2');

      expect(params1[0].name).toBe('param1');
      expect(params2[0].name).toBe('param2');
    });

    it('should return empty array for method without params', () => {
      const params = MetadataStorage.getParamsMetadata(TestClass.prototype, 'nonexistent');
      expect(params).toEqual([]);
    });
  });
});
