import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Documented, ServerDocumented } from '../decorators/documented.js';
import { Param } from '../decorators/param.js';
import { Prompt } from '../decorators/prompt.js';
import { Resource } from '../decorators/resource.js';
import { MCPServer } from '../decorators/server.js';
import { Tool } from '../decorators/tool.js';
import {
  DocGenerator,
  extractServerDoc,
  formatJson,
  formatMarkdown,
  formatOpenAPI,
  generateDocs,
} from './index.js';

describe('Documentation Generator', () => {
  @MCPServer({ name: 'test-server', version: '1.0.0', description: 'Test server' })
  @ServerDocumented({
    description: 'A test MCP server for documentation testing',
    contact: { name: 'Test', email: 'test@example.com' },
    license: { name: 'MIT' },
  })
  class TestServer {
    @Tool({ description: 'Greet someone' })
    @Documented({
      summary: 'Generate a greeting',
      tags: ['greeting', 'utility'],
      examples: [{ name: 'Basic greeting', input: { name: 'World' }, output: 'Hello, World!' }],
      since: '1.0.0',
    })
    async greet(@Param({ name: 'name', description: 'Name to greet' }) name: string) {
      return `Hello, ${name}!`;
    }

    @Resource({ uri: 'data://{id}', name: 'Data', description: 'Get data by ID' })
    @Documented({
      summary: 'Retrieve data',
      tags: ['data'],
      deprecated: true,
      deprecationMessage: 'Use getDataV2 instead',
    })
    async getData(@Param({ name: 'id' }) id: string) {
      return { id, data: 'test' };
    }

    @Prompt({ name: 'story', description: 'Generate a story' })
    @Documented({
      summary: 'Create a creative story',
      tags: ['creative'],
      notes: ['Supports multiple genres', 'Length varies by topic'],
    })
    async storyPrompt(@Param({ name: 'topic' }) topic: string) {
      return [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: `Write a story about ${topic}` },
        },
      ];
    }
  }

  describe('extractServerDoc', () => {
    it('should extract basic server info', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.name).toBe('test-server');
      expect(doc.version).toBe('1.0.0');
      // Description comes from @MCPServer first, fallback to @ServerDocumented
      expect(doc.description).toBe('Test server');
    });

    it('should extract server documentation', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.serverDocs).toBeDefined();
      expect(doc.serverDocs?.contact?.email).toBe('test@example.com');
      expect(doc.serverDocs?.license?.name).toBe('MIT');
    });

    it('should extract tools with documentation', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.tools).toHaveLength(1);
      expect(doc.tools[0].name).toBe('greet');
      expect(doc.tools[0].description).toBe('Greet someone');
      expect(doc.tools[0].summary).toBe('Generate a greeting');
      expect(doc.tools[0].tags).toContain('greeting');
      expect(doc.tools[0].since).toBe('1.0.0');
      expect(doc.tools[0].examples).toHaveLength(1);
    });

    it('should extract tool parameters', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.tools[0].params).toHaveLength(1);
      expect(doc.tools[0].params[0].name).toBe('name');
      expect(doc.tools[0].params[0].description).toBe('Name to greet');
    });

    it('should extract resources with deprecation info', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.resources).toHaveLength(1);
      expect(doc.resources[0].name).toBe('Data');
      expect(doc.resources[0].uri).toBe('data://{id}');
      expect(doc.resources[0].deprecated).toBe(true);
      expect(doc.resources[0].deprecationMessage).toBe('Use getDataV2 instead');
    });

    it('should extract prompts with notes', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.prompts).toHaveLength(1);
      expect(doc.prompts[0].name).toBe('story');
      expect(doc.prompts[0].summary).toBe('Create a creative story');
      expect(doc.prompts[0].notes).toHaveLength(2);
    });

    it('should include generation metadata', () => {
      const doc = extractServerDoc(TestServer);

      expect(doc.generatedAt).toBeDefined();
      expect(doc.generatorVersion).toBe('1.0.0');
    });
  });

  describe('DocGenerator', () => {
    let generator: DocGenerator;

    beforeEach(() => {
      generator = new DocGenerator(TestServer);
    });

    it('should generate JSON documentation', () => {
      const result = generator.toJSON();

      expect(result.format).toBe('json');
      expect(result.extension).toBe('.json');
      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('should generate Markdown documentation', () => {
      const result = generator.toMarkdown();

      expect(result.format).toBe('markdown');
      expect(result.extension).toBe('.md');
      expect(result.content).toContain('# test-server API Documentation');
      expect(result.content).toContain('## Tools');
      expect(result.content).toContain('### greet');
    });

    it('should generate OpenAPI documentation', () => {
      const result = generator.toOpenAPI();

      expect(result.format).toBe('openapi');
      expect(result.extension).toBe('.openapi.json');

      const spec = JSON.parse(result.content);
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('test-server');
      expect(spec.paths['/tools/greet']).toBeDefined();
    });

    it('should filter deprecated items when option is set', () => {
      const result = generator.toJSON({ includeDeprecated: false });
      const doc = JSON.parse(result.content);

      expect(doc.resources).toHaveLength(0);
    });

    it('should exclude examples when option is set', () => {
      const result = generator.toJSON({ includeExamples: false });
      const doc = JSON.parse(result.content);

      expect(doc.tools[0].examples).toBeUndefined();
    });
  });

  describe('formatters', () => {
    it('formatJson should produce valid JSON', () => {
      const doc = extractServerDoc(TestServer);
      const result = formatJson(doc);

      expect(result.format).toBe('json');
      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('test-server');
    });

    it('formatMarkdown should include ToC', () => {
      const doc = extractServerDoc(TestServer);
      const result = formatMarkdown(doc);

      expect(result.content).toContain('## Table of Contents');
      expect(result.content).toContain('- [Tools](#tools)');
    });

    it('formatOpenAPI should include request/response schemas', () => {
      const doc = extractServerDoc(TestServer);
      const result = formatOpenAPI(doc);
      const spec = JSON.parse(result.content);

      expect(spec.paths['/tools/greet'].post.requestBody).toBeDefined();
      expect(spec.paths['/tools/greet'].post.responses['200']).toBeDefined();
    });
  });

  describe('generateDocs', () => {
    it('should generate docs with default format', () => {
      const result = generateDocs(TestServer);

      expect(result.format).toBe('json');
    });

    it('should generate docs with specified format', () => {
      const result = generateDocs(TestServer, { format: 'markdown' });

      expect(result.format).toBe('markdown');
    });
  });
});
