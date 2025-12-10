import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';

const execAsync = promisify(exec);

interface InitOptions {
  template: string;
  typescript: boolean;
  git: boolean;
  install: boolean;
}

interface ProjectAnswers {
  name: string;
  description: string;
  author: string;
  transport: string;
}

/**
 * Initialize a new mcpkit project
 */
export async function initCommand(name: string | undefined, options: InitOptions): Promise<void> {
  console.log(chalk.bold('\n🚀 Create a new mcpkit MCP server\n'));

  // Get project details interactively if not provided
  const answers = await inquirer.prompt<ProjectAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: name ?? 'my-mcp-server',
      validate: (input: string) => {
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'An MCP server built with mcpkit',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: '',
    },
    {
      type: 'list',
      name: 'transport',
      message: 'Default transport:',
      choices: [
        { name: 'stdio (recommended for CLI tools)', value: 'stdio' },
        { name: 'Streamable HTTP (for web services)', value: 'streamable-http' },
        { name: 'SSE (legacy HTTP)', value: 'sse' },
      ],
      default: 'stdio',
    },
  ]);

  const projectName = answers.name;
  const projectPath = path.resolve(process.cwd(), projectName);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${projectName} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\nProject creation cancelled.'));
      return;
    }

    await fs.remove(projectPath);
  }

  const spinner = ora('Creating project structure...').start();

  try {
    // Create project directory
    await fs.ensureDir(projectPath);

    // Create project files
    await createProjectFiles(projectPath, {
      ...answers,
      template: options.template,
    });

    spinner.succeed('Project structure created');

    // Initialize git
    if (options.git) {
      spinner.start('Initializing git repository...');
      try {
        await execAsync('git init', { cwd: projectPath });
        await fs.writeFile(
          path.join(projectPath, '.gitignore'),
          'node_modules/\ndist/\n.env\n*.log\n',
        );
        spinner.succeed('Git repository initialized');
      } catch {
        spinner.warn('Failed to initialize git repository');
      }
    }

    // Install dependencies
    if (options.install) {
      spinner.start('Installing dependencies...');
      try {
        await execAsync('npm install', { cwd: projectPath });
        spinner.succeed('Dependencies installed');
      } catch {
        spinner.warn('Failed to install dependencies. Run npm install manually.');
      }
    }

    // Success message
    console.log(chalk.green('\n✅ Project created successfully!\n'));
    console.log('Next steps:');
    console.log(chalk.cyan(`  cd ${projectName}`));
    if (!options.install) {
      console.log(chalk.cyan('  npm install'));
    }
    console.log(chalk.cyan('  npm run dev'));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to create project');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Create all project files from template
 */
async function createProjectFiles(
  projectPath: string,
  config: ProjectAnswers & { template: string },
): Promise<void> {
  // package.json
  await fs.writeJSON(
    path.join(projectPath, 'package.json'),
    {
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
    },
    { spaces: 2 },
  );

  // tsconfig.json
  await fs.writeJSON(
    path.join(projectPath, 'tsconfig.json'),
    {
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
    },
    { spaces: 2 },
  );

  // tsup.config.ts
  await fs.writeFile(
    path.join(projectPath, 'tsup.config.ts'),
    `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  outDir: 'dist',
});
`,
  );

  // Create src directory
  await fs.ensureDir(path.join(projectPath, 'src'));

  // Main server file
  const serverCode = generateServerCode(config);
  await fs.writeFile(path.join(projectPath, 'src/index.ts'), serverCode);

  // README.md
  await fs.writeFile(
    path.join(projectPath, 'README.md'),
    `# ${config.name}

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
`,
  );
}

/**
 * Generate the main server code based on template
 */
function generateServerCode(config: ProjectAnswers & { template: string }): string {
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
