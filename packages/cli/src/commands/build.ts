import { spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';

interface BuildOptions {
  output: string;
}

/**
 * Build the MCP server for production
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a valid project
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    console.error(chalk.red('Error: No package.json found in current directory.'));
    console.log(chalk.yellow('Make sure you are in an mcpkit project directory.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n📦 Building mcpkit MCP server...\n'));

  const spinner = ora('Running type check...').start();

  try {
    // Run type check first
    await runCommand('npx', ['tsc', '--noEmit'], cwd);
    spinner.succeed('Type check passed');

    // Build with tsup
    spinner.start('Building with tsup...');
    await runCommand('npx', ['tsup', '--outDir', options.output], cwd);
    spinner.succeed('Build completed');

    // Show output info
    const distPath = path.join(cwd, options.output);
    const files = await fs.readdir(distPath);

    console.log(chalk.green('\n✅ Build successful!\n'));
    console.log(chalk.gray('Output files:'));
    for (const file of files) {
      const filePath = path.join(distPath, file);
      const stats = await fs.stat(filePath);
      const size = formatBytes(stats.size);
      console.log(chalk.gray(`  ${file} (${size})`));
    }
    console.log('');
  } catch (error) {
    spinner.fail('Build failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Run a command and wait for it to complete
 */
function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      shell: true,
    });

    let stderr = '';

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', reject);

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
