# TestSetup Schema

A TestSetup defines how the Claude agent is configured for a test run.

## Fields

| Field | Type | Required | Description | Constraints | Example |
|-------|------|----------|-------------|-------------|---------|
| `id` | `string` | Yes | Unique identifier (UUID v4) | Non-empty | `"a1b2c3d4-..."` |
| `name` | `string` | Yes | Human-readable name | Non-empty | `"My Anthropic Setup"` |
| `description` | `string` | Yes | Description of this setup | Can be empty string | `"Test setup for..."` |
| `provider` | `ProviderConfig` | Yes | Provider authentication config | See Provider section | See below |
| `claudeMdFiles` | `ClaudeMdEntry[]` | Yes | CLAUDE.md file contents | Max 2 entries | See below |
| `rules` | `RuleEntry[]` | Yes | Named rules | Can be empty | `[]` |
| `skills` | `SkillEntry[]` | Yes | Named skills | Can be empty | `[]` |
| `subagents` | `SubagentEntry[]` | Yes | Subagent definitions | Can be empty | `[]` |
| `mcpServers` | `McpServerEntry[]` | Yes | MCP server configs | Can be empty | `[]` |
| `permissionMode` | `string` | Yes | SDK permission mode | One of: `"default"`, `"acceptEdits"`, `"bypassPermissions"`, `"plan"`, `"dontAsk"` | `"acceptEdits"` |
| `timeoutSeconds` | `number` | Yes | Max runtime in seconds | Positive integer | `300` |
| `maxTurns` | `number` | No | Max conversation turns | Positive integer | `10` |
| `maxBudgetUsd` | `number` | No | Max spend in USD | Positive number | `1.50` |
| `allowedTools` | `string[]` | No | Restrict to these tools | Non-empty strings | `["Read", "Edit"]` |
| `thinking` | `ThinkingConfig` | No | Extended thinking config | See Thinking section | See below |
| `effort` | `string` | No | Effort level | One of: `"low"`, `"medium"`, `"high"` | `"medium"` |
| `createdAt` | `string` | Yes | ISO 8601 timestamp | Valid ISO date | `"2026-03-24T00:00:00.000Z"` |
| `updatedAt` | `string` | Yes | ISO 8601 timestamp | Valid ISO date | `"2026-03-24T00:00:00.000Z"` |

## ProviderConfig

Discriminated union on `kind`.

### API Provider (`kind: "api"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `"api"` | Yes | Provider type |
| `baseUrl` | `string` | Yes | API endpoint URL |
| `apiKey` | `string` | Yes | API key |
| `model` | `string` | Yes | Model identifier |

### OAuth Provider (`kind: "oauth"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `"oauth"` | Yes | Provider type |
| `oauthToken` | `string` | Yes | OAuth token |
| `model` | `string` | Yes | Model identifier |

## ClaudeMdEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | `string` | Yes | One of: `"project"`, `"user"` |
| `content` | `string` | Yes | Markdown content |
| `loadFromFile` | `string` | No | Load content from file path instead |

## RuleEntry / SkillEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Name of the rule/skill |
| `content` | `string` | Yes | Content/definition |
| `loadFromFile` | `string` | No | Load content from file path instead |

## SubagentEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Subagent name |
| `description` | `string` | Yes | What the subagent does |
| `prompt` | `string` | Yes | System prompt |
| `tools` | `string[]` | No | Allowed tools |
| `model` | `string` | No | Model override |
| `loadFromFile` | `string` | No | Load prompt from file |

## McpServerEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Server name |
| `config` | `McpServerConfig` | Yes | Transport config (see below) |

### McpServerConfig (discriminated on `transport`)

**stdio**: `{ transport: "stdio", command: string, args?: string[], env?: Record<string, string> }`

**http**: `{ transport: "http", url: string, headers?: Record<string, string> }`

**sse**: `{ transport: "sse", url: string, headers?: Record<string, string> }`

## ThinkingConfig

Discriminated union on `kind`:

- `{ kind: "adaptive" }` -- adaptive thinking (default)
- `{ kind: "enabled", budgetTokens: number }` -- fixed token budget
- `{ kind: "disabled" }` -- no extended thinking
