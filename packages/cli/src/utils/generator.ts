/**
 * Project configuration for code generation
 */
export interface ProjectConfig {
  name: string;
  description: string;
  author: string;
  transport: string;
  template: string;
}

/**
 * Validate a project name
 * @returns true if valid, error message if invalid
 */
export function validateProjectName(name: string): true | string {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty';
  }

  if (!/^[a-z0-9-_]+$/i.test(name)) {
    return 'Project name can only contain letters, numbers, hyphens, and underscores';
  }

  if (name.length > 214) {
    return 'Project name cannot exceed 214 characters';
  }

  return true;
}

/**
 * Generate package.json content
 */
export function generatePackageJson(config: ProjectConfig): object {
  return {
    name: config.name,
    version: '0.1.0',
    description: config.description,
    type: 'module',
    main: 'dist/index.js',
    scripts: {
      build: 'tsup',
      dev: 'tsup --watch',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit',
    },
    author: config.author,
    license: 'MIT',
    dependencies: {
      '@mcpkit-dev/core': '^0.1.0',
    },
    devDependencies: {
      '@types/node': '^22.10.2',
      tsup: '^8.3.5',
      typescript: '^5.7.2',
    },
  };
}

/**
 * Generate tsconfig.json content
 */
export function generateTsConfig(): object {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };
}

/**
 * Generate tsup.config.ts content
 */
export function generateTsupConfig(): string {
  return `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  outDir: 'dist',
});
`;
}

/**
 * Generate .gitignore content
 */
export function generateGitignore(): string {
  return 'node_modules/\ndist/\n.env\n*.log\n';
}

/**
 * Generate the main server code based on configuration
 */
export function generateServerCode(config: ProjectConfig): string {
  const transportImport =
    config.transport === 'stdio' ? '' : `\nimport type { ListenOptions } from '@mcpkit-dev/core';`;

  const transportOptions =
    config.transport === 'stdio'
      ? ''
      : `

const listenOptions: ListenOptions = {
  transport: '${config.transport}',
  port: 3000,
  host: 'localhost',
};`;

  const listenCall =
    config.transport === 'stdio' ? 'await server.listen();' : 'await server.listen(listenOptions);';

  const serverUrl =
    config.transport === 'stdio'
      ? ''
      : `
  console.log('Server running at http://localhost:3000');`;

  return `import { MCPServer, Tool, Resource, Prompt, Param } from '@mcpkit-dev/core';${transportImport}

/**
 * ${config.description}
 */
@MCPServer({
  name: '${config.name}',
  version: '0.1.0',
})
class Server {
  /**
   * A simple greeting tool
   */
  @Tool({ description: 'Say hello to someone' })
  async greet(@Param({ description: 'Name to greet' }) name: string): Promise<string> {
    return \`Hello, \${name}! Welcome to ${config.name}.\`;
  }

  /**
   * Get server information
   */
  @Resource({
    uri: 'info://server',
    name: 'Server Info',
    description: 'Get information about this server',
  })
  async getServerInfo(): Promise<string> {
    return JSON.stringify({
      name: '${config.name}',
      version: '0.1.0',
      description: '${config.description}',
    }, null, 2);
  }

  /**
   * A helpful prompt template
   */
  @Prompt({
    name: 'help',
    description: 'Get help using this server',
  })
  async helpPrompt(): Promise<{ messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }> }> {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'How do I use the ${config.name} server?',
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'This server provides the following capabilities:\\n\\n' +
              '**Tools:**\\n' +
              '- greet: Say hello to someone\\n\\n' +
              '**Resources:**\\n' +
              '- info://server: Get server information\\n\\n' +
              'Use the greet tool with a name parameter to get started!',
          },
        },
      ],
    };
  }
}
${transportOptions}

// Create and start the server
const server = new Server();
${listenCall}${serverUrl}
`;
}

/**
 * Generate README.md content
 */
export function generateReadme(config: ProjectConfig, projectPath: string): string {
  return `# ${config.name}

${config.description}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Build the server
npm run build

# Run in development mode
npm run dev

# Start the server
npm start
\`\`\`

## Usage

This MCP server was created with [mcpkit](https://github.com/v-checha/mcpkit).

### With Claude Desktop

Add to your Claude Desktop config:

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "node",
      "args": ["${projectPath}/dist/index.js"]
    }
  }
}
\`\`\`

## License

MIT
`;
}
