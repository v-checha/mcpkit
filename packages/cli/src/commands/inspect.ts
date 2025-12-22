import chalk from 'chalk';

interface InspectOptions {
  url: string;
  token?: string;
  format: string;
}

/**
 * Inspect a running MCP server
 */
export async function inspectCommand(options: InspectOptions): Promise<void> {
  const baseUrl = options.url.replace(/\/$/, '');

  console.log(chalk.bold('\n🔍 Inspecting MCP server...\n'));
  console.log(chalk.gray(`  URL: ${baseUrl}\n`));

  try {
    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    // Fetch inspection data
    const response = await fetch(`${baseUrl}/_inspect`, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        console.error(chalk.red('Error: Unauthorized. Use --token to provide authentication.'));
        process.exit(1);
      }
      if (response.status === 404) {
        console.error(chalk.red('Error: Inspection endpoint not found.'));
        console.log(chalk.yellow('Make sure the server has inspection enabled.'));
        process.exit(1);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (options.format === 'json') {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Display formatted output
    displayInspectionResult(data);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(chalk.red('Error: Could not connect to server.'));
      console.log(chalk.yellow('Make sure the server is running and accessible.'));
    } else {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
    process.exit(1);
  }
}

/**
 * Display formatted inspection result
 */
function displayInspectionResult(data: {
  server?: {
    name?: string;
    version?: string;
    description?: string;
    tools?: Array<{ name: string; description?: string }>;
    resources?: Array<{ name: string; uri: string; description?: string }>;
    prompts?: Array<{ name: string; description?: string }>;
  };
  stats?: {
    uptime?: number;
    totalRequests?: number;
    requestsByType?: { tools?: number; resources?: number; prompts?: number };
    errorCount?: number;
    avgResponseTime?: number;
    activeSessions?: number;
  };
  health?: {
    status?: string;
    checks?: Record<string, { status: string; message?: string; responseTime?: number }>;
    timestamp?: string;
  };
}): void {
  // Server info
  if (data.server) {
    const server = data.server;
    console.log(chalk.bold.cyan('📦 Server Information\n'));
    console.log(`  Name:    ${chalk.white(server.name ?? 'Unknown')}`);
    console.log(`  Version: ${chalk.white(server.version ?? 'Unknown')}`);
    if (server.description) {
      console.log(`  Description: ${chalk.gray(server.description)}`);
    }
    console.log('');
  }

  // Health status
  if (data.health) {
    const health = data.health;
    const statusColor =
      health.status === 'healthy'
        ? chalk.green
        : health.status === 'degraded'
          ? chalk.yellow
          : chalk.red;

    console.log(chalk.bold.cyan('💚 Health Status\n'));
    console.log(`  Status: ${statusColor(health.status ?? 'Unknown')}`);

    if (health.checks) {
      console.log('');
      for (const [name, check] of Object.entries(health.checks)) {
        const checkColor =
          check.status === 'healthy'
            ? chalk.green
            : check.status === 'degraded'
              ? chalk.yellow
              : chalk.red;

        let line = `    ${checkColor('●')} ${name}: ${checkColor(check.status)}`;
        if (check.message) {
          line += chalk.gray(` - ${check.message}`);
        }
        if (check.responseTime !== undefined) {
          line += chalk.gray(` (${check.responseTime}ms)`);
        }
        console.log(line);
      }
    }
    console.log('');
  }

  // Statistics
  if (data.stats) {
    const stats = data.stats;
    console.log(chalk.bold.cyan('📊 Statistics\n'));

    if (stats.uptime !== undefined) {
      const uptime = formatUptime(stats.uptime);
      console.log(`  Uptime:           ${chalk.white(uptime)}`);
    }

    if (stats.totalRequests !== undefined) {
      console.log(`  Total Requests:   ${chalk.white(stats.totalRequests.toLocaleString())}`);
    }

    if (stats.requestsByType) {
      const byType = stats.requestsByType;
      console.log(`    Tools:          ${chalk.white(byType.tools ?? 0)}`);
      console.log(`    Resources:      ${chalk.white(byType.resources ?? 0)}`);
      console.log(`    Prompts:        ${chalk.white(byType.prompts ?? 0)}`);
    }

    if (stats.errorCount !== undefined) {
      const errorColor = stats.errorCount > 0 ? chalk.red : chalk.green;
      console.log(`  Errors:           ${errorColor(stats.errorCount)}`);
    }

    if (stats.avgResponseTime !== undefined) {
      console.log(`  Avg Response:     ${chalk.white(`${stats.avgResponseTime}ms`)}`);
    }

    if (stats.activeSessions !== undefined) {
      console.log(`  Active Sessions:  ${chalk.white(stats.activeSessions)}`);
    }

    console.log('');
  }

  // Capabilities
  if (data.server) {
    const server = data.server;

    // Tools
    if (server.tools && server.tools.length > 0) {
      console.log(chalk.bold.cyan('🔧 Tools\n'));
      for (const tool of server.tools) {
        console.log(`  ${chalk.white(tool.name)}`);
        if (tool.description) {
          console.log(`    ${chalk.gray(tool.description)}`);
        }
      }
      console.log('');
    }

    // Resources
    if (server.resources && server.resources.length > 0) {
      console.log(chalk.bold.cyan('📁 Resources\n'));
      for (const resource of server.resources) {
        console.log(`  ${chalk.white(resource.name)} ${chalk.gray(`(${resource.uri})`)}`);
        if (resource.description) {
          console.log(`    ${chalk.gray(resource.description)}`);
        }
      }
      console.log('');
    }

    // Prompts
    if (server.prompts && server.prompts.length > 0) {
      console.log(chalk.bold.cyan('💬 Prompts\n'));
      for (const prompt of server.prompts) {
        console.log(`  ${chalk.white(prompt.name)}`);
        if (prompt.description) {
          console.log(`    ${chalk.gray(prompt.description)}`);
        }
      }
      console.log('');
    }
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
