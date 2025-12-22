/**
 * Markdown formatter for server documentation
 */

import type {
  DocGeneratorOptions,
  DocGeneratorResult,
  ParamDoc,
  PromptDoc,
  ResourceDoc,
  ServerDoc,
  ToolDoc,
} from '../types.js';

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([*_`~\[\]()\\])/g, '\\$1');
}

/**
 * Format a parameter table
 */
function formatParamTable(params: ParamDoc[]): string {
  if (params.length === 0) {
    return '_No parameters_\n';
  }

  const lines: string[] = [
    '| Parameter | Type | Required | Description |',
    '|-----------|------|----------|-------------|',
  ];

  for (const param of params) {
    const required = param.required ? 'Yes' : 'No';
    const desc = param.description ? escapeMarkdown(param.description) : '-';
    lines.push(`| \`${param.name}\` | ${param.type} | ${required} | ${desc} |`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Format tool documentation
 */
function formatTool(tool: ToolDoc, options: DocGeneratorOptions): string {
  const lines: string[] = [];

  // Title with deprecation warning
  const deprecationBadge = tool.deprecated ? ' ⚠️ **DEPRECATED**' : '';
  lines.push(`### ${tool.name}${deprecationBadge}\n`);

  // Deprecation message
  if (tool.deprecated && tool.deprecationMessage) {
    lines.push(`> ⚠️ ${tool.deprecationMessage}\n`);
  }

  // Summary/description
  if (tool.summary) {
    lines.push(`**${tool.summary}**\n`);
  }
  if (tool.description) {
    lines.push(`${tool.description}\n`);
  }

  // Tags
  if (tool.tags && tool.tags.length > 0) {
    const tags = tool.tags.map((t) => `\`${t}\``).join(' ');
    lines.push(`**Tags:** ${tags}\n`);
  }

  // Version info
  if (tool.since) {
    lines.push(`**Since:** v${tool.since}\n`);
  }

  // Annotations
  if (tool.annotations) {
    const hints: string[] = [];
    if (tool.annotations.readOnlyHint) hints.push('read-only');
    if (tool.annotations.destructiveHint) hints.push('destructive');
    if (tool.annotations.idempotentHint) hints.push('idempotent');
    if (tool.annotations.openWorldHint) hints.push('open-world');

    if (hints.length > 0) {
      lines.push(`**Hints:** ${hints.join(', ')}\n`);
    }
  }

  // Parameters
  lines.push('#### Parameters\n');
  lines.push(formatParamTable(tool.params));

  // Examples
  if (options.includeExamples !== false && tool.examples && tool.examples.length > 0) {
    lines.push('#### Examples\n');

    for (const example of tool.examples) {
      lines.push(`**${example.name}**\n`);

      if (example.description) {
        lines.push(`${example.description}\n`);
      }

      if (example.input) {
        lines.push('Input:');
        lines.push('```json');
        lines.push(JSON.stringify(example.input, null, 2));
        lines.push('```\n');
      }

      if (example.output !== undefined) {
        lines.push('Output:');
        lines.push('```json');
        lines.push(JSON.stringify(example.output, null, 2));
        lines.push('```\n');
      }
    }
  }

  // Notes
  if (tool.notes && tool.notes.length > 0) {
    lines.push('#### Notes\n');
    for (const note of tool.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // See also
  if (tool.seeAlso && tool.seeAlso.length > 0) {
    lines.push(`**See also:** ${tool.seeAlso.join(', ')}\n`);
  }

  lines.push('---\n');

  return lines.join('\n');
}

/**
 * Format resource documentation
 */
function formatResource(resource: ResourceDoc, options: DocGeneratorOptions): string {
  const lines: string[] = [];

  const deprecationBadge = resource.deprecated ? ' ⚠️ **DEPRECATED**' : '';
  lines.push(`### ${resource.name}${deprecationBadge}\n`);

  if (resource.deprecated && resource.deprecationMessage) {
    lines.push(`> ⚠️ ${resource.deprecationMessage}\n`);
  }

  // URI
  lines.push(`**URI:** \`${resource.uri}\`\n`);

  // MIME type
  if (resource.mimeType) {
    lines.push(`**MIME Type:** \`${resource.mimeType}\`\n`);
  }

  // Summary/description
  if (resource.summary) {
    lines.push(`**${resource.summary}**\n`);
  }
  if (resource.description) {
    lines.push(`${resource.description}\n`);
  }

  // Tags
  if (resource.tags && resource.tags.length > 0) {
    const tags = resource.tags.map((t) => `\`${t}\``).join(' ');
    lines.push(`**Tags:** ${tags}\n`);
  }

  // Version info
  if (resource.since) {
    lines.push(`**Since:** v${resource.since}\n`);
  }

  // URI Parameters
  if (resource.params.length > 0) {
    lines.push('#### URI Parameters\n');
    lines.push(formatParamTable(resource.params));
  }

  // Examples
  if (options.includeExamples !== false && resource.examples && resource.examples.length > 0) {
    lines.push('#### Examples\n');

    for (const example of resource.examples) {
      lines.push(`**${example.name}**\n`);

      if (example.description) {
        lines.push(`${example.description}\n`);
      }

      if (example.input) {
        lines.push('Input:');
        lines.push('```json');
        lines.push(JSON.stringify(example.input, null, 2));
        lines.push('```\n');
      }

      if (example.output !== undefined) {
        lines.push('Output:');
        lines.push('```json');
        lines.push(JSON.stringify(example.output, null, 2));
        lines.push('```\n');
      }
    }
  }

  // Notes
  if (resource.notes && resource.notes.length > 0) {
    lines.push('#### Notes\n');
    for (const note of resource.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // See also
  if (resource.seeAlso && resource.seeAlso.length > 0) {
    lines.push(`**See also:** ${resource.seeAlso.join(', ')}\n`);
  }

  lines.push('---\n');

  return lines.join('\n');
}

/**
 * Format prompt documentation
 */
function formatPrompt(prompt: PromptDoc, options: DocGeneratorOptions): string {
  const lines: string[] = [];

  const deprecationBadge = prompt.deprecated ? ' ⚠️ **DEPRECATED**' : '';
  lines.push(`### ${prompt.name}${deprecationBadge}\n`);

  if (prompt.deprecated && prompt.deprecationMessage) {
    lines.push(`> ⚠️ ${prompt.deprecationMessage}\n`);
  }

  // Summary/description
  if (prompt.summary) {
    lines.push(`**${prompt.summary}**\n`);
  }
  if (prompt.description) {
    lines.push(`${prompt.description}\n`);
  }

  // Tags
  if (prompt.tags && prompt.tags.length > 0) {
    const tags = prompt.tags.map((t) => `\`${t}\``).join(' ');
    lines.push(`**Tags:** ${tags}\n`);
  }

  // Version info
  if (prompt.since) {
    lines.push(`**Since:** v${prompt.since}\n`);
  }

  // Arguments
  if (prompt.params.length > 0) {
    lines.push('#### Arguments\n');
    lines.push(formatParamTable(prompt.params));
  }

  // Examples
  if (options.includeExamples !== false && prompt.examples && prompt.examples.length > 0) {
    lines.push('#### Examples\n');

    for (const example of prompt.examples) {
      lines.push(`**${example.name}**\n`);

      if (example.description) {
        lines.push(`${example.description}\n`);
      }

      if (example.input) {
        lines.push('Input:');
        lines.push('```json');
        lines.push(JSON.stringify(example.input, null, 2));
        lines.push('```\n');
      }

      if (example.output !== undefined) {
        lines.push('Output:');
        lines.push('```json');
        lines.push(JSON.stringify(example.output, null, 2));
        lines.push('```\n');
      }
    }
  }

  // Notes
  if (prompt.notes && prompt.notes.length > 0) {
    lines.push('#### Notes\n');
    for (const note of prompt.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // See also
  if (prompt.seeAlso && prompt.seeAlso.length > 0) {
    lines.push(`**See also:** ${prompt.seeAlso.join(', ')}\n`);
  }

  lines.push('---\n');

  return lines.join('\n');
}

/**
 * Format server documentation as Markdown
 *
 * @param doc - Server documentation
 * @param options - Generator options
 * @returns Formatted Markdown documentation
 *
 * @example
 * ```typescript
 * const docs = extractServerDoc(MyServer);
 * const result = formatMarkdown(docs, { includeExamples: true });
 * fs.writeFileSync('API.md', result.content);
 * ```
 */
export function formatMarkdown(
  doc: ServerDoc,
  options: DocGeneratorOptions = {},
): DocGeneratorResult {
  const lines: string[] = [];

  // Title
  lines.push(`# ${doc.name} API Documentation\n`);

  // Version
  lines.push(`**Version:** ${doc.version}\n`);

  // Description
  if (doc.description) {
    lines.push(`${doc.description}\n`);
  }

  // Server documentation
  if (doc.serverDocs) {
    // Contact
    if (doc.serverDocs.contact) {
      const contact = doc.serverDocs.contact;
      const parts: string[] = [];
      if (contact.name) parts.push(contact.name);
      if (contact.email) parts.push(`[${contact.email}](mailto:${contact.email})`);
      if (contact.url) parts.push(`[${contact.url}](${contact.url})`);
      if (parts.length > 0) {
        lines.push(`**Contact:** ${parts.join(' | ')}\n`);
      }
    }

    // License
    if (doc.serverDocs.license) {
      const license = doc.serverDocs.license;
      if (license.url) {
        lines.push(`**License:** [${license.name}](${license.url})\n`);
      } else {
        lines.push(`**License:** ${license.name}\n`);
      }
    }

    // External docs
    if (doc.serverDocs.externalDocs) {
      const desc = doc.serverDocs.externalDocs.description ?? 'External Documentation';
      lines.push(`**Documentation:** [${desc}](${doc.serverDocs.externalDocs.url})\n`);
    }
  }

  // Table of contents
  lines.push('## Table of Contents\n');

  if (doc.tools.length > 0) {
    lines.push('- [Tools](#tools)');
    for (const tool of doc.tools) {
      if (!options.includeDeprecated && tool.deprecated) continue;
      lines.push(`  - [${tool.name}](#${tool.name.toLowerCase()})`);
    }
  }

  if (doc.resources.length > 0) {
    lines.push('- [Resources](#resources)');
    for (const resource of doc.resources) {
      if (!options.includeDeprecated && resource.deprecated) continue;
      lines.push(`  - [${resource.name}](#${resource.name.toLowerCase()})`);
    }
  }

  if (doc.prompts.length > 0) {
    lines.push('- [Prompts](#prompts)');
    for (const prompt of doc.prompts) {
      if (!options.includeDeprecated && prompt.deprecated) continue;
      lines.push(`  - [${prompt.name}](#${prompt.name.toLowerCase()})`);
    }
  }

  lines.push('');

  // Tools section
  if (doc.tools.length > 0) {
    lines.push('## Tools\n');

    for (const tool of doc.tools) {
      if (!options.includeDeprecated && tool.deprecated) continue;
      lines.push(formatTool(tool, options));
    }
  }

  // Resources section
  if (doc.resources.length > 0) {
    lines.push('## Resources\n');

    for (const resource of doc.resources) {
      if (!options.includeDeprecated && resource.deprecated) continue;
      lines.push(formatResource(resource, options));
    }
  }

  // Prompts section
  if (doc.prompts.length > 0) {
    lines.push('## Prompts\n');

    for (const prompt of doc.prompts) {
      if (!options.includeDeprecated && prompt.deprecated) continue;
      lines.push(formatPrompt(prompt, options));
    }
  }

  // Footer
  lines.push('---\n');
  lines.push(`_Generated at ${doc.generatedAt} by MCPKit v${doc.generatorVersion}_\n`);

  return {
    content: lines.join('\n'),
    format: 'markdown',
    extension: '.md',
  };
}
