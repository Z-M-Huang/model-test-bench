// ---------------------------------------------------------------------------
// Map setup types to SDK option types for agents and MCP servers
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import type { AgentDefinition, McpServerConfig as SDKMcpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import type { SubagentEntry, McpServerEntry } from '../types/index.js';

/**
 * Convert our SubagentEntry[] into the SDK's Record<string, AgentDefinition>.
 * If `loadFromFile` is set, the prompt is read from that path at build time.
 */
export async function buildAgentsMap(
  subagents: readonly SubagentEntry[],
): Promise<Record<string, AgentDefinition>> {
  const result: Record<string, AgentDefinition> = {};

  for (const sa of subagents) {
    let prompt = sa.prompt;
    if (sa.loadFromFile) {
      prompt = await fs.readFile(sa.loadFromFile, 'utf-8');
    }

    const def: AgentDefinition = {
      description: sa.description,
      prompt,
    };

    if (sa.tools && sa.tools.length > 0) {
      def.tools = [...sa.tools];
    }

    if (sa.model) {
      def.model = sa.model;
    }

    result[sa.name] = def;
  }

  return result;
}

/**
 * Convert our McpServerEntry[] into the SDK's Record<string, McpServerConfig>.
 */
export function buildMcpMap(
  servers: readonly McpServerEntry[],
): Record<string, SDKMcpServerConfig> {
  const result: Record<string, SDKMcpServerConfig> = {};

  for (const entry of servers) {
    const cfg = entry.config;
    switch (cfg.transport) {
      case 'stdio':
        result[entry.name] = {
          command: cfg.command,
          args: cfg.args ? [...cfg.args] : undefined,
          env: cfg.env ? { ...cfg.env } : undefined,
        };
        break;
      case 'http':
        result[entry.name] = {
          type: 'http',
          url: cfg.url,
          headers: cfg.headers ? { ...cfg.headers } : undefined,
        };
        break;
      case 'sse':
        result[entry.name] = {
          type: 'sse',
          url: cfg.url,
          headers: cfg.headers ? { ...cfg.headers } : undefined,
        };
        break;
    }
  }

  return result;
}
