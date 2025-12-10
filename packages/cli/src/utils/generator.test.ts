import { describe, expect, it } from 'vitest';
import {
  generateGitignore,
  generatePackageJson,
  generateReadme,
  generateServerCode,
  generateTsConfig,
  generateTsupConfig,
  type ProjectConfig,
  validateProjectName,
} from './generator.js';

describe('generator utilities', () => {
  const defaultConfig: ProjectConfig = {
    name: 'test-server',
    description: 'A test MCP server',
    author: 'Test Author',
    transport: 'stdio',
    template: 'basic',
  };

  describe('validateProjectName', () => {
    it('should accept valid project names', () => {
      expect(validateProjectName('my-project')).toBe(true);
      expect(validateProjectName('my_project')).toBe(true);
      expect(validateProjectName('myProject123')).toBe(true);
      expect(validateProjectName('a')).toBe(true);
      expect(validateProjectName('test-server')).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateProjectName('')).toBe('Project name cannot be empty');
      expect(validateProjectName('   ')).toBe('Project name cannot be empty');
    });

    it('should reject names with invalid characters', () => {
      expect(validateProjectName('my project')).toContain('only contain');
      expect(validateProjectName('my@project')).toContain('only contain');
      expect(validateProjectName('my.project')).toContain('only contain');
      expect(validateProjectName('my/project')).toContain('only contain');
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(215);
      expect(validateProjectName(longName)).toContain('cannot exceed 214');
    });

    it('should accept names at the length limit', () => {
      const maxLengthName = 'a'.repeat(214);
      expect(validateProjectName(maxLengthName)).toBe(true);
    });
  });

  describe('generatePackageJson', () => {
    it('should generate valid package.json structure', () => {
      const result = generatePackageJson(defaultConfig);

      expect(result).toHaveProperty('name', 'test-server');
      expect(result).toHaveProperty('version', '0.1.0');
      expect(result).toHaveProperty('description', 'A test MCP server');
      expect(result).toHaveProperty('type', 'module');
      expect(result).toHaveProperty('author', 'Test Author');
    });

    it('should include required scripts', () => {
      const result = generatePackageJson(defaultConfig) as { scripts: Record<string, string> };

      expect(result.scripts).toHaveProperty('build', 'tsup');
      expect(result.scripts).toHaveProperty('dev', 'tsup --watch');
      expect(result.scripts).toHaveProperty('start', 'node dist/index.js');
      expect(result.scripts).toHaveProperty('typecheck', 'tsc --noEmit');
    });

    it('should include mcpkit-dev/core dependency', () => {
      const result = generatePackageJson(defaultConfig) as { dependencies: Record<string, string> };

      expect(result.dependencies).toHaveProperty('@mcpkit-dev/core');
    });

    it('should include reflect-metadata dependency', () => {
      const result = generatePackageJson(defaultConfig) as { dependencies: Record<string, string> };

      expect(result.dependencies).toHaveProperty('reflect-metadata');
    });

    it('should include required dev dependencies', () => {
      const result = generatePackageJson(defaultConfig) as {
        devDependencies: Record<string, string>;
      };

      expect(result.devDependencies).toHaveProperty('@types/node');
      expect(result.devDependencies).toHaveProperty('tsup');
      expect(result.devDependencies).toHaveProperty('typescript');
    });
  });

  describe('generateTsConfig', () => {
    it('should generate valid tsconfig structure', () => {
      const result = generateTsConfig() as { compilerOptions: Record<string, unknown> };

      expect(result).toHaveProperty('compilerOptions');
      expect(result).toHaveProperty('include');
      expect(result).toHaveProperty('exclude');
    });

    it('should enable decorator support', () => {
      const result = generateTsConfig() as { compilerOptions: Record<string, unknown> };

      expect(result.compilerOptions.experimentalDecorators).toBe(true);
      expect(result.compilerOptions.emitDecoratorMetadata).toBe(true);
    });

    it('should use NodeNext module resolution', () => {
      const result = generateTsConfig() as { compilerOptions: Record<string, unknown> };

      expect(result.compilerOptions.module).toBe('NodeNext');
      expect(result.compilerOptions.moduleResolution).toBe('NodeNext');
    });

    it('should exclude node_modules and dist', () => {
      const result = generateTsConfig() as { exclude: string[] };

      expect(result.exclude).toContain('node_modules');
      expect(result.exclude).toContain('dist');
    });
  });

  describe('generateTsupConfig', () => {
    it('should generate valid tsup config', () => {
      const result = generateTsupConfig();

      expect(result).toContain("entry: ['src/index.ts']");
      expect(result).toContain("format: ['esm']");
      expect(result).toContain('dts: true');
      expect(result).toContain("target: 'node18'");
    });

    it('should include defineConfig import', () => {
      const result = generateTsupConfig();

      expect(result).toContain("import { defineConfig } from 'tsup'");
    });
  });

  describe('generateGitignore', () => {
    it('should include node_modules', () => {
      const result = generateGitignore();

      expect(result).toContain('node_modules/');
    });

    it('should include dist folder', () => {
      const result = generateGitignore();

      expect(result).toContain('dist/');
    });

    it('should include .env', () => {
      const result = generateGitignore();

      expect(result).toContain('.env');
    });

    it('should include log files', () => {
      const result = generateGitignore();

      expect(result).toContain('*.log');
    });
  });

  describe('generateServerCode', () => {
    it('should generate server code for stdio transport', () => {
      const result = generateServerCode(defaultConfig);

      expect(result).toContain('@MCPServer');
      expect(result).toContain("name: 'test-server'");
      expect(result).toContain('@Tool');
      expect(result).toContain('@Resource');
      expect(result).toContain('@Prompt');
      expect(result).toContain('await server.listen();');
    });

    it('should not include transport options for stdio', () => {
      const result = generateServerCode(defaultConfig);

      expect(result).not.toContain('ListenOptions');
      expect(result).not.toContain('listenOptions');
    });

    it('should include transport options for streamable-http', () => {
      const httpConfig = { ...defaultConfig, transport: 'streamable-http' };
      const result = generateServerCode(httpConfig);

      expect(result).toContain('ListenOptions');
      expect(result).toContain("transport: 'streamable-http'");
      expect(result).toContain('port: 3000');
      expect(result).toContain("host: 'localhost'");
    });

    it('should include server URL console.log for HTTP transports', () => {
      const httpConfig = { ...defaultConfig, transport: 'streamable-http' };
      const result = generateServerCode(httpConfig);

      expect(result).toContain("console.log('Server running at http://localhost:3000')");
    });

    it('should include project description in comment', () => {
      const result = generateServerCode(defaultConfig);

      expect(result).toContain('* A test MCP server');
    });

    it('should include greet tool with project name', () => {
      const result = generateServerCode(defaultConfig);

      expect(result).toContain('Welcome to test-server');
    });

    it('should handle SSE transport', () => {
      const sseConfig = { ...defaultConfig, transport: 'sse' };
      const result = generateServerCode(sseConfig);

      expect(result).toContain("transport: 'sse'");
      expect(result).toContain('ListenOptions');
    });
  });

  describe('generateReadme', () => {
    it('should include project name as title', () => {
      const result = generateReadme(defaultConfig, '/path/to/project');

      expect(result).toContain('# test-server');
    });

    it('should include project description', () => {
      const result = generateReadme(defaultConfig, '/path/to/project');

      expect(result).toContain('A test MCP server');
    });

    it('should include getting started instructions', () => {
      const result = generateReadme(defaultConfig, '/path/to/project');

      expect(result).toContain('npm install');
      expect(result).toContain('npm run build');
      expect(result).toContain('npm run dev');
      expect(result).toContain('npm start');
    });

    it('should include Claude Desktop configuration', () => {
      const result = generateReadme(defaultConfig, '/path/to/project');

      expect(result).toContain('Claude Desktop');
      expect(result).toContain('mcpServers');
      expect(result).toContain('/path/to/project/dist/index.js');
    });

    it('should include mcpkit link', () => {
      const result = generateReadme(defaultConfig, '/path/to/project');

      expect(result).toContain('[mcpkit](https://github.com/v-checha/mcpkit)');
    });
  });
});
