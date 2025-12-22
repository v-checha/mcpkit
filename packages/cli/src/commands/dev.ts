import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { HotReloadManager } from '../utils/hot-reload.js';

interface DevOptions {
  port: string;
  transport: string;
  watch: boolean;
  clear: boolean;
}

let childProcess: ChildProcess | null = null;
let hotReloadManager: HotReloadManager | null = null;

/**
 * Start the MCP server in development mode
 */
export async function devCommand(options: DevOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a valid project
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    console.error(chalk.red('Error: No package.json found in current directory.'));
    console.log(chalk.yellow('Make sure you are in an mcpkit project directory.'));
    process.exit(1);
  }

  // Check for tsup config
  const hasTsup =
    (await fs.pathExists(path.join(cwd, 'tsup.config.ts'))) ||
    (await fs.pathExists(path.join(cwd, 'tsup.config.js')));

  if (!hasTsup) {
    console.error(chalk.red('Error: No tsup config found.'));
    console.log(chalk.yellow('Make sure you have a tsup.config.ts file in your project.'));
    process.exit(1);
  }

  // Set environment variables
  const env: Record<string, string> = {
    MCPKIT_TRANSPORT: options.transport,
    MCPKIT_PORT: options.port,
    NODE_ENV: 'development',
  };

  // Use enhanced hot reload if watch mode is enabled
  if (options.watch) {
    hotReloadManager = new HotReloadManager({
      cwd,
      entry: 'dist/index.js',
      watchDirs: ['src'],
      env,
      buildCommand: 'npx',
      buildArgs: ['tsup'],
      clearConsole: options.clear,
      debounce: 300,
      onStart: () => {
        if (options.transport !== 'stdio') {
          console.log(chalk.gray(`  Transport: ${options.transport}`));
          console.log(chalk.gray(`  Port: ${options.port}\n`));
        }
      },
    });

    await hotReloadManager.start();
    return;
  }

  // Non-watch mode: build once and run
  console.log(chalk.bold('\n🔧 Starting mcpkit development server...\n'));
  console.log(chalk.gray(`Transport: ${options.transport}`));
  if (options.transport !== 'stdio') {
    console.log(chalk.gray(`Port: ${options.port}`));
  }
  console.log('');

  try {
    // Build first
    console.log(chalk.yellow('Building...'));
    await new Promise<void>((resolve, reject) => {
      const build = spawn('npx', ['tsup'], {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'inherit',
        shell: true,
      });

      build.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });

      build.on('error', reject);
    });

    // Run server
    console.log(chalk.green('\n✓ Build complete, starting server...\n'));

    childProcess = spawn('node', ['dist/index.js'], {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    childProcess.on('error', (error) => {
      console.error(chalk.red(`Failed to start: ${error.message}`));
      process.exit(1);
    });

    childProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`Process exited with code ${code}`));
        process.exit(code);
      }
    });

    // Handle graceful shutdown
    const cleanup = () => {
      if (childProcess) {
        console.log(chalk.yellow('\nShutting down...'));
        childProcess.kill('SIGTERM');
        childProcess = null;
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}
