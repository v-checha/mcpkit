/**
 * JSON formatter for server documentation
 */

import type { DocGeneratorOptions, DocGeneratorResult, ServerDoc } from '../types.js';

/**
 * Filter documentation based on options
 */
function filterDoc(doc: ServerDoc, options: DocGeneratorOptions): ServerDoc {
  const filtered = { ...doc };

  // Filter deprecated items
  if (!options.includeDeprecated) {
    filtered.tools = filtered.tools.filter((t) => !t.deprecated);
    filtered.resources = filtered.resources.filter((r) => !r.deprecated);
    filtered.prompts = filtered.prompts.filter((p) => !p.deprecated);
  }

  // Filter by tags
  if (options.filterTags && options.filterTags.length > 0) {
    const tags = new Set(options.filterTags);

    filtered.tools = filtered.tools.filter(
      (t) => t.tags?.some((tag) => tags.has(tag)),
    );
    filtered.resources = filtered.resources.filter(
      (r) => r.tags?.some((tag) => tags.has(tag)),
    );
    filtered.prompts = filtered.prompts.filter(
      (p) => p.tags?.some((tag) => tags.has(tag)),
    );
  }

  // Remove examples if not included
  if (!options.includeExamples) {
    filtered.tools = filtered.tools.map((t) => {
      const { examples, ...rest } = t;
      return rest;
    });
    filtered.resources = filtered.resources.map((r) => {
      const { examples, ...rest } = r;
      return rest;
    });
    filtered.prompts = filtered.prompts.map((p) => {
      const { examples, ...rest } = p;
      return rest;
    });
  }

  return filtered;
}

/**
 * Format server documentation as JSON
 *
 * @param doc - Server documentation
 * @param options - Generator options
 * @returns Formatted JSON documentation
 *
 * @example
 * ```typescript
 * const docs = extractServerDoc(MyServer);
 * const result = formatJson(docs, { includeExamples: true });
 * console.log(result.content); // JSON string
 * ```
 */
export function formatJson(
  doc: ServerDoc,
  options: DocGeneratorOptions = {},
): DocGeneratorResult {
  const filtered = filterDoc(doc, {
    includeExamples: options.includeExamples ?? true,
    includeDeprecated: options.includeDeprecated ?? true,
    ...options,
  });

  return {
    content: JSON.stringify(filtered, null, 2),
    format: 'json',
    extension: '.json',
  };
}
