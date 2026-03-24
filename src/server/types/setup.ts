// ---------------------------------------------------------------------------
// Provider & Setup Types
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
  readonly model?: string;
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

/** Effort level for Claude. */
export type EffortLevel = 'low' | 'medium' | 'high';

/** Scoring dimension used to evaluate a run. */
export interface ScoringDimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

/** A complete test setup that defines how the agent is configured. */
export interface TestSetup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly provider: ProviderConfig;
  readonly claudeMdFiles: readonly ClaudeMdEntry[]; // max 2
  readonly rules: readonly RuleEntry[];
  readonly skills: readonly SkillEntry[];
  readonly subagents: readonly SubagentEntry[];
  readonly mcpServers: readonly McpServerEntry[];
  readonly permissionMode: PermissionMode;
  readonly maxTurns?: number;
  readonly maxBudgetUsd?: number;
  readonly timeoutSeconds: number;
  readonly allowedTools?: readonly string[];
  readonly thinking?: ThinkingConfig;
  readonly effort?: EffortLevel;
  readonly createdAt: string;
  readonly updatedAt: string;
}
