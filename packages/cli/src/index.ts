import chalk from 'chalk';
import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { devCommand } from './commands/dev.js';
import { docsCommand } from './commands/docs.js';
import { initCommand } from './commands/init.js';
import { inspectCommand } from './commands/inspect.js';

const program = new Command();

program
  .name('mcpkit')
  .description('CLI tool for creating and managing mcpkit MCP servers')
  .version('0.1.0');

program
  .command('init')
  .description('Create a new mcpkit MCP server project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use (basic, advanced)', 'basic')
  .option('--typescript', 'Use TypeScript (default)', true)
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip installing dependencies')
  .action(initCommand);

program
  .command('dev')
  .description('Start the MCP server in development mode')
  .option('-p, --port <port>', 'Port for HTTP transport', '3000')
  .option('--transport <type>', 'Transport type (stdio, http, streamable-http)', 'stdio')
  .option('--watch', 'Watch for file changes', true)
  .option('--no-watch', 'Disable watch mode')
  .option('--clear', 'Clear console on reload', true)
  .option('--no-clear', 'Disable console clearing')
  .action(devCommand);

program
  .command('build')
  .description('Build the MCP server for production')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .action(buildCommand);

program
  .command('docs')
  .description('Generate API documentation from the MCP server')
  .option('-f, --format <format>', 'Output format (json, markdown, openapi)', 'markdown')
  .option('-o, --output <file>', 'Output file path')
  .option('--examples', 'Include examples in documentation', true)
  .option('--no-examples', 'Exclude examples from documentation')
  .option('--deprecated', 'Include deprecated items', true)
  .option('--no-deprecated', 'Exclude deprecated items')
  .action(docsCommand);

program
  .command('inspect')
  .description('Inspect a running MCP server')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:3000')
  .option('-t, --token <token>', 'Authentication token')
  .option('-f, --format <format>', 'Output format (pretty, json)', 'pretty')
  .action(inspectCommand);

program.parse();

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  console.log(`Run ${chalk.cyan('mcpkit --help')} for available commands.`);
  process.exit(1);
});
