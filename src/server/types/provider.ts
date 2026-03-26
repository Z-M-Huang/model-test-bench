// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Discriminated union for provider authentication strategies. */
export type ProviderConfig = ApiProviderConfig | OAuthProviderConfig;

export interface ApiProviderConfig {
  readonly kind: 'api';
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export interface OAuthProviderConfig {
  readonly kind: 'oauth';
  readonly oauthToken: string;
  readonly model: string;
}

/** Discriminated union for thinking configuration. */
export type ThinkingConfig =
  | { readonly kind: 'adaptive' }
  | { readonly kind: 'enabled'; readonly budgetTokens: number }
  | { readonly kind: 'disabled' };

/** A CLAUDE.md entry that can be inlined or loaded from a file. */
export interface ClaudeMdEntry {
  readonly role: 'project' | 'user';
  readonly content: string;
  readonly loadFromFile?: string;
}

/** A named rule entry. */
export interface RuleEntry {
  readonly name: string;
  readonly content: string;
  readonly loadFromFile?: string;
}

/** A named skill entry. */
export interface SkillEntry {
  readonly name: string;
  readonly content: string;
  readonly loadFromFile?: string;
}

/** A named subagent definition. */
export interface SubagentEntry {
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly tools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly model?: string;
  readonly mcpServers?: readonly string[];
  readonly skills?: readonly string[];
  readonly maxTurns?: number;
  readonly loadFromFile?: string;
}

/** MCP server transport configs — discriminated on `transport`. */
export interface McpStdioConfig {
  readonly transport: 'stdio';
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

export interface McpHttpConfig {
  readonly transport: 'http';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface McpSseConfig {
  readonly transport: 'sse';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export type McpServerConfig = McpStdioConfig | McpHttpConfig | McpSseConfig;

/** A named MCP server entry. */
export interface McpServerEntry {
  readonly name: string;
  readonly config: McpServerConfig;
}

/** Permission mode passed to the SDK. */
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk';

/** Effort level for Claude. 'none' = not applicable (e.g. non-Anthropic providers). */
export type EffortLevel = 'none' | 'low' | 'medium' | 'high';

/** Scoring dimension used to evaluate a run. */
export interface ScoringDimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

/** A provider configuration that defines how to connect to an LLM provider. */
export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly provider: ProviderConfig;
  readonly thinking?: ThinkingConfig;
  readonly effort?: EffortLevel;
  readonly timeoutSeconds: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
