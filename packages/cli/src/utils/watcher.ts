import { type FSWatcher, type WatchEventType, watch } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Options for file watcher
 */
export interface WatcherOptions {
  /**
   * Patterns to ignore (glob-style)
   */
  ignore?: string[];

  /**
   * File extensions to watch
   * @default ['.ts', '.js', '.json']
   */
  extensions?: string[];

  /**
   * Debounce delay in milliseconds
   * @default 100
   */
  debounce?: number;

  /**
   * Enable recursive watching
   * @default true
   */
  recursive?: boolean;
}

/**
 * Event emitted by the watcher
 */
export interface WatchEvent {
  type: WatchEventType;
  filename: string;
  path: string;
}

/**
 * Callback for file changes
 */
export type WatchCallback = (event: WatchEvent) => void;

/**
 * Default patterns to ignore
 */
const DEFAULT_IGNORE = ['node_modules', 'dist', '.git', '.DS_Store', '*.log', '*.map', 'coverage'];

/**
 * Default extensions to watch
 */
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mts', '.mjs'];

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filepath: string, patterns: string[]): boolean {
  const basename = path.basename(filepath);
  const parts = filepath.split(path.sep);

  for (const pattern of patterns) {
    // Simple glob matching
    if (pattern.startsWith('*')) {
      const ext = pattern.slice(1);
      if (basename.endsWith(ext)) return true;
    } else if (parts.includes(pattern) || basename === pattern) {
      return true;
    }
  }

  return false;
}

/**
 * Check if file has a watched extension
 */
function hasWatchedExtension(filename: string, extensions: string[]): boolean {
  return extensions.some((ext) => filename.endsWith(ext));
}

/**
 * File watcher using Node.js fs.watch
 *
 * Provides debounced file change notifications for development mode.
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcher('./src', {
 *   extensions: ['.ts', '.js'],
 *   debounce: 200,
 * });
 *
 * watcher.on('change', (event) => {
 *   console.log(`File changed: ${event.path}`);
 * });
 *
 * await watcher.start();
 * ```
 */
export class FileWatcher {
  private watchers: FSWatcher[] = [];
  private options: Required<WatcherOptions>;
  private callback: WatchCallback | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingEvents: Map<string, WatchEvent> = new Map();
  private running = false;

  constructor(
    private rootDir: string,
    options: WatcherOptions = {},
  ) {
    this.options = {
      ignore: options.ignore ?? DEFAULT_IGNORE,
      extensions: options.extensions ?? DEFAULT_EXTENSIONS,
      debounce: options.debounce ?? 100,
      recursive: options.recursive ?? true,
    };
  }

  /**
   * Set the callback for file changes
   */
  on(event: 'change', callback: WatchCallback): this {
    if (event === 'change') {
      this.callback = callback;
    }
    return this;
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await this.watchDirectory(this.rootDir);
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.running = false;

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Watch a directory and its subdirectories
   */
  private async watchDirectory(dir: string): Promise<void> {
    if (!this.running) return;

    // Skip ignored directories
    if (shouldIgnore(dir, this.options.ignore)) {
      return;
    }

    try {
      const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
        if (filename) {
          this.handleEvent(eventType, filename, dir);
        }
      });

      watcher.on('error', (error) => {
        // Ignore errors for deleted directories
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`Watch error on ${dir}:`, error.message);
        }
      });

      this.watchers.push(watcher);

      // Recursively watch subdirectories
      if (this.options.recursive) {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subdir = path.join(dir, entry.name);
            await this.watchDirectory(subdir);
          }
        }
      }
    } catch (error) {
      // Ignore errors for non-existent directories
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Handle a file system event
   */
  private handleEvent(eventType: WatchEventType, filename: string, dir: string): void {
    const filepath = path.join(dir, filename);

    // Skip ignored files
    if (shouldIgnore(filepath, this.options.ignore)) {
      return;
    }

    // Skip files without watched extensions
    if (!hasWatchedExtension(filename, this.options.extensions)) {
      return;
    }

    const event: WatchEvent = {
      type: eventType,
      filename,
      path: filepath,
    };

    // Debounce events
    this.pendingEvents.set(filepath, event);
    this.scheduleFlush();
  }

  /**
   * Schedule flushing of pending events
   */
  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents();
    }, this.options.debounce);
  }

  /**
   * Flush pending events to callback
   */
  private flushEvents(): void {
    if (!this.callback) return;

    for (const event of this.pendingEvents.values()) {
      this.callback(event);
    }

    this.pendingEvents.clear();
  }
}

/**
 * Create a file watcher
 */
export function createWatcher(rootDir: string, options?: WatcherOptions): FileWatcher {
  return new FileWatcher(rootDir, options);
}
