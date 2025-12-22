import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import { FileWatcher, type WatchEvent } from './watcher.js';

/**
 * Options for hot reload manager
 */
export interface HotReloadOptions {
  /**
   * Working directory
   */
  cwd: string;

  /**
   * Entry file to run
   */
  entry: string;

  /**
   * Source directories to watch
   * @default ['src']
   */
  watchDirs?: string[];

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Build command to run before starting
   */
  buildCommand?: string;

  /**
   * Build arguments
   */
  buildArgs?: string[];

  /**
   * Clear console on reload
   * @default true
   */
  clearConsole?: boolean;

  /**
   * Debounce delay for file changes
   * @default 300
   */
  debounce?: number;

  /**
   * Callback when server starts
   */
  onStart?: () => void;

  /**
   * Callback when server restarts
   */
  onRestart?: (changedFile: string) => void;

  /**
   * Callback when build fails
   */
  onBuildError?: (error: Error) => void;
}

/**
 * State of the hot reload manager
 */
export type HotReloadState = 'idle' | 'building' | 'running' | 'restarting' | 'stopped';

/**
 * Hot reload manager for development mode
 *
 * Watches source files and automatically rebuilds and restarts
 * the server when changes are detected.
 *
 * @example
 * ```typescript
 * const hotReload = new HotReloadManager({
 *   cwd: process.cwd(),
 *   entry: 'dist/index.js',
 *   watchDirs: ['src'],
 *   buildCommand: 'npx',
 *   buildArgs: ['tsup'],
 * });
 *
 * await hotReload.start();
 * ```
 */
export class HotReloadManager {
  private options: Required<
    Pick<HotReloadOptions, 'watchDirs' | 'clearConsole' | 'debounce'>
  > &
    HotReloadOptions;
  private watcher: FileWatcher | null = null;
  private serverProcess: ChildProcess | null = null;
  private buildProcess: ChildProcess | null = null;
  private state: HotReloadState = 'idle';
  private restartQueued = false;
  private lastChangedFile: string | null = null;
  private startTime: number = 0;

  constructor(options: HotReloadOptions) {
    this.options = {
      watchDirs: ['src'],
      clearConsole: true,
      debounce: 300,
      ...options,
    };
  }

  /**
   * Get current state
   */
  getState(): HotReloadState {
    return this.state;
  }

  /**
   * Start the hot reload manager
   */
  async start(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'stopped') {
      return;
    }

    this.startTime = Date.now();
    this.printHeader();

    // Initial build
    await this.build();

    // Start watching
    this.startWatching();

    // Start server
    await this.startServer();

    // Handle process signals
    this.setupSignalHandlers();
  }

  /**
   * Stop the hot reload manager
   */
  async stop(): Promise<void> {
    this.state = 'stopped';

    // Stop watcher
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }

    // Kill server process
    await this.killServer();

    // Kill build process
    if (this.buildProcess) {
      this.buildProcess.kill('SIGTERM');
      this.buildProcess = null;
    }
  }

  /**
   * Print startup header
   */
  private printHeader(): void {
    if (this.options.clearConsole) {
      console.clear();
    }

    console.log(chalk.bold.cyan('\n  ⚡ MCPKit Dev Server\n'));
    console.log(chalk.gray(`  Watching: ${this.options.watchDirs.join(', ')}`));
    console.log(chalk.gray(`  Entry: ${this.options.entry}`));
    console.log('');
  }

  /**
   * Run the build command
   */
  private async build(): Promise<boolean> {
    if (!this.options.buildCommand) {
      return true;
    }

    this.state = 'building';
    const startTime = Date.now();

    console.log(chalk.yellow('  ⏳ Building...'));

    return new Promise((resolve) => {
      this.buildProcess = spawn(
        this.options.buildCommand!,
        this.options.buildArgs ?? [],
        {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        },
      );

      let stderr = '';

      this.buildProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      this.buildProcess.on('close', (code) => {
        this.buildProcess = null;
        const duration = Date.now() - startTime;

        if (code === 0) {
          console.log(chalk.green(`  ✓ Built in ${duration}ms\n`));
          resolve(true);
        } else {
          console.log(chalk.red(`  ✗ Build failed\n`));
          if (stderr) {
            console.log(chalk.red(stderr));
          }
          this.options.onBuildError?.(new Error(`Build failed with code ${code}`));
          resolve(false);
        }
      });

      this.buildProcess.on('error', (error) => {
        this.buildProcess = null;
        console.log(chalk.red(`  ✗ Build error: ${error.message}\n`));
        this.options.onBuildError?.(error);
        resolve(false);
      });
    });
  }

  /**
   * Start the server process
   */
  private async startServer(): Promise<void> {
    const entryPath = path.join(this.options.cwd, this.options.entry);

    this.state = 'running';

    this.serverProcess = spawn('node', [entryPath], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: 'inherit',
    });

    this.serverProcess.on('error', (error) => {
      console.log(chalk.red(`  ✗ Server error: ${error.message}`));
    });

    this.serverProcess.on('exit', (code, signal) => {
      this.serverProcess = null;

      // Don't log if we killed it intentionally
      if (this.state === 'restarting' || this.state === 'stopped') {
        return;
      }

      if (code !== 0 && code !== null) {
        console.log(chalk.red(`  ✗ Server exited with code ${code}`));
      }
    });

    this.options.onStart?.();
    console.log(chalk.green('  ✓ Server running'));
    console.log(chalk.gray('  Waiting for changes...\n'));
  }

  /**
   * Kill the server process
   */
  private async killServer(): Promise<void> {
    if (!this.serverProcess) return;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown fails
        this.serverProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.serverProcess.once('exit', () => {
        clearTimeout(timeout);
        this.serverProcess = null;
        resolve();
      });

      this.serverProcess.kill('SIGTERM');
    });
  }

  /**
   * Start watching for file changes
   */
  private startWatching(): void {
    for (const dir of this.options.watchDirs) {
      const watchPath = path.join(this.options.cwd, dir);

      const watcher = new FileWatcher(watchPath, {
        debounce: this.options.debounce,
      });

      watcher.on('change', (event) => {
        this.handleFileChange(event);
      });

      watcher.start().catch((error) => {
        console.log(chalk.yellow(`  ⚠ Could not watch ${dir}: ${error.message}`));
      });

      this.watcher = watcher;
    }
  }

  /**
   * Handle a file change event
   */
  private handleFileChange(event: WatchEvent): void {
    if (this.state === 'stopped') return;

    // Queue restart if already building/restarting
    if (this.state === 'building' || this.state === 'restarting') {
      this.restartQueued = true;
      this.lastChangedFile = event.path;
      return;
    }

    this.lastChangedFile = event.path;
    this.restart();
  }

  /**
   * Restart the server
   */
  private async restart(): Promise<void> {
    if (this.state === 'stopped') return;

    const relativePath = path.relative(this.options.cwd, this.lastChangedFile ?? '');

    this.state = 'restarting';

    if (this.options.clearConsole) {
      console.clear();
      this.printHeader();
    }

    console.log(chalk.cyan(`  ↻ Changed: ${relativePath}`));
    this.options.onRestart?.(this.lastChangedFile ?? '');

    // Kill existing server
    await this.killServer();

    // Rebuild
    const buildSuccess = await this.build();

    // Start server if build succeeded
    if (buildSuccess) {
      await this.startServer();
    } else {
      this.state = 'idle';
      console.log(chalk.yellow('  Waiting for changes to retry...\n'));
    }

    // Handle queued restart
    if (this.restartQueued) {
      this.restartQueued = false;
      setTimeout(() => this.restart(), 100);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const cleanup = async () => {
      console.log(chalk.yellow('\n  Shutting down...'));
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

/**
 * Create a hot reload manager
 */
export function createHotReload(options: HotReloadOptions): HotReloadManager {
  return new HotReloadManager(options);
}
