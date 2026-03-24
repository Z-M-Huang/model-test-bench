# Scenario Schema

A Scenario defines a prompt and its expected outcomes for evaluating a Claude agent.

## Fields

| Field | Type | Required | Description | Constraints | Example |
|-------|------|----------|-------------|-------------|---------|
| `id` | `string` | Yes | Unique identifier (UUID v4) | Non-empty | `"a1b2c3d4-..."` |
| `name` | `string` | Yes | Human-readable name | Non-empty | `"Multi-file Refactor"` |
| `category` | `ScenarioCategory` | Yes | Classification category | See categories below | `"planning"` |
| `builtIn` | `boolean` | Yes | Whether this is a built-in scenario | `true` or `false` | `false` |
| `prompt` | `string` | Yes | The user prompt sent to the agent | Non-empty | `"Refactor the..."` |
| `workspaceFiles` | `WorkspaceFile[]` | Yes | Files pre-populated in workspace | Can be empty | See below |
| `expectedAnswer` | `string` | Yes | Description of the ideal response | Can be empty string | `"A separate auth module..."` |
| `criticalRequirements` | `string[]` | Yes | Must-pass requirements | Can be empty | `["Auth logic separated"]` |
| `gradingGuidelines` | `string` | Yes | Free-text grading instructions | Can be empty string | `"Award full marks if..."` |
| `scoringDimensions` | `ScoringDimension[]` | Yes | Weighted scoring dimensions | Weights must sum to 1.0 (if non-empty) | See below |
| `createdAt` | `string` | Yes | ISO 8601 timestamp | Valid ISO date | `"2026-03-24T00:00:00.000Z"` |
| `updatedAt` | `string` | Yes | ISO 8601 timestamp | Valid ISO date | `"2026-03-24T00:00:00.000Z"` |

## ScenarioCategory

One of:
- `"planning"` -- Planning and strategy tasks
- `"instruction-following"` -- Following specific instructions
- `"reasoning"` -- Logic and reasoning tasks
- `"tool-strategy"` -- Tool selection and usage
- `"error-handling"` -- Recovering from errors
- `"ambiguity-handling"` -- Dealing with ambiguous requirements
- `"scope-management"` -- Staying within scope
- `"custom"` -- User-defined category

## WorkspaceFile

A file pre-populated in the workspace before the scenario runs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | Relative file path in workspace |
| `content` | `string` | Yes | File content |

## ScoringDimension

A weighted dimension for evaluation scoring.

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Dimension name | Non-empty |
| `weight` | `number` | Yes | Weight for this dimension | 0.0 to 1.0; all weights must sum to 1.0 |
| `description` | `string` | Yes | What this dimension measures | Non-empty |
