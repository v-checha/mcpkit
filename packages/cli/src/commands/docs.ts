import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';

interface DocsOptions {
  format: string;
  output?: string;
  examples: boolean;
  deprecated: boolean;
}

/**
 * Generate documentation from an MCP server
 */
export async function docsCommand(options: DocsOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a valid project
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    console.error(chalk.red('Error: No package.json found in current directory.'));
    console.log(chalk.yellow('Make sure you are in an mcpkit project directory.'));
    process.exit(1);
  }

  // Check if dist exists
  const distPath = path.join(cwd, 'dist');
  if (!(await fs.pathExists(distPath))) {
    console.error(chalk.red('Error: No dist directory found.'));
    console.log(chalk.yellow('Run "mcpkit build" first to build the project.'));
    process.exit(1);
  }

  // Check for index.js
  const entryPath = path.join(distPath, 'index.js');
  if (!(await fs.pathExists(entryPath))) {
    console.error(chalk.red('Error: No dist/index.js found.'));
    console.log(chalk.yellow('Make sure the project builds correctly.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n📄 Generating documentation...\n'));

  try {
    // Dynamically import the server module
    const serverModule = await import(entryPath);

    // Find the server class (decorated with @MCPServer)
    let serverClass: unknown = null;
    for (const exportName of Object.keys(serverModule)) {
      const exported = serverModule[exportName];
      if (typeof exported === 'function' && exported.prototype) {
        // Check if it has server metadata
        const metadata = Reflect.getMetadata('mcpkit:serverOptions', exported);
        if (metadata) {
          serverClass = exported;
          break;
        }
      }
    }

    // Also check default export
    if (!serverClass && serverModule.default) {
      const defaultExport = serverModule.default;
      if (typeof defaultExport === 'function') {
        const metadata = Reflect.getMetadata('mcpkit:serverOptions', defaultExport);
        if (metadata) {
          serverClass = defaultExport;
        }
      }
    }

    if (!serverClass) {
      console.error(chalk.red('Error: No @MCPServer decorated class found in the module.'));
      console.log(chalk.yellow('Make sure your server class is exported and decorated with @MCPServer.'));
      process.exit(1);
    }

    // Import documentation generator from core
    const { generateDocs } = await import('@mcpkit-dev/core');

    // Generate documentation
    const result = generateDocs(serverClass as new () => object, {
      format: options.format as 'json' | 'markdown' | 'openapi',
      includeExamples: options.examples,
      includeDeprecated: options.deprecated,
    });

    // Determine output path
    let outputPath: string;
    if (options.output) {
      outputPath = path.resolve(cwd, options.output);
    } else {
      // Default output based on format
      const baseName = 'api-docs';
      outputPath = path.join(cwd, `${baseName}${result.extension}`);
    }

    // Write output file
    await fs.writeFile(outputPath, result.content, 'utf-8');

    console.log(chalk.green(`✓ Documentation generated: ${outputPath}`));
    console.log(chalk.gray(`  Format: ${result.format}`));
    console.log(chalk.gray(`  Size: ${(result.content.length / 1024).toFixed(2)} KB\n`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}
