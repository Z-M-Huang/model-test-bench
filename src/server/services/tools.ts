// ---------------------------------------------------------------------------
// Built-in Tools — tool definitions for AI SDK generateText()
// ---------------------------------------------------------------------------

import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Read a file by path and return its content. */
const readFileTool = tool({
  description: 'Read a file at the given path and return its content.',
  inputSchema: z.object({
    path: z.string().describe('Absolute or relative file path to read'),
  }),
  execute: async ({ path: filePath }) => {
    const resolved = path.resolve(filePath);
    const content = await fs.readFile(resolved, 'utf-8');
    return content;
  },
});

/** Search file contents by pattern (grep-like). */
const searchFileTool = tool({
  description: 'Search file contents by regex pattern. Returns matching lines with file:line references.',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('Directory or file path to search in (defaults to cwd)'),
  }),
  execute: async ({ pattern, path: searchPath }) => {
    const dir = searchPath ? path.resolve(searchPath) : process.cwd();
    const regex = new RegExp(pattern, 'g');
    const results: string[] = [];

    async function searchDir(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
                regex.lastIndex = 0;
              }
            }
          } catch { /* skip binary/unreadable files */ }
        }
        if (results.length >= 50) return;
      }
    }

    await searchDir(dir);
    return results.length > 0
      ? results.join('\n')
      : `No matches found for pattern: ${pattern}`;
  },
});

/** Web search (placeholder — not available in benchmark mode). */
const webSearchTool = tool({
  description: 'Search the web for information. Returns search results.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    return `Web search is not available in benchmark mode. Query was: "${query}"`;
  },
});

/** Registry of all built-in tools. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_REGISTRY: Record<string, ReturnType<typeof tool<any, any>>> = {
  read_file: readFileTool,
  search_file: searchFileTool,
  web_search: webSearchTool,
};

/** Get the list of all available tool names. */
export function getAvailableToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/** Get enabled tools filtered by name. Returns empty object if none enabled. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEnabledTools(
  enabledToolNames: readonly string[],
): Record<string, ReturnType<typeof tool<any, any>>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, ReturnType<typeof tool<any, any>>> = {};
  for (const name of enabledToolNames) {
    if (TOOL_REGISTRY[name]) {
      result[name] = TOOL_REGISTRY[name];
    }
  }
  return result;
}
