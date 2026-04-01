# Model Test Bench -- Project Guidelines

## Project Goal

Build a model-agnostic benchmarking tool for testing LLM configurations. The tool measures how system prompts and model parameters influence model behavior across providers (Anthropic, OpenAI, Google). Users create Providers (API config), Scenarios (task + rubric), run them, and evaluate results through a web UI.

## Architecture

```
bin/mtb.ts  -->  Express app (src/server/index.ts)  -->  React SPA (src/web/)
                      |
         IStorage  IRunner  IEvaluator  ILogger
            |          |         |          |
     JsonFileStorage  AiSdkRunner  EvaluationOrchestrator  JsonLogger
            |          |         |
     .model-test-bench/   generateText()   generateText() (split-query eval)
```

- **Express 5 backend** (`src/server/`) with REST API + SSE for run progress
- **React 19 frontend** (`src/web/`) with Tailwind CSS v4 (no component libraries)
- **File-based JSON storage** in `.model-test-bench/` (providers, scenarios, runs, evaluations)
- **Vercel AI SDK** for scenario execution (`generateText()`) and evaluation
- **Model Factory** (`model-factory.ts`) creates provider-specific model instances via `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
- **LLM-based evaluation** with instruction compliance analysis (split-query strategy)

## Code Rules

- No file exceeds 300 lines (README.md and CLAUDE.md are exempt)
- No `any` types -- use discriminated unions and strong types
- Every service class implements an interface (`IStorage`, `IRunner`, `IEvaluator`, `ILogger`)
- Unit test coverage > 95% (vitest)
- E2E tests with Playwright
- ESM imports with `.js` extensions (required for Node ESM resolution)
- Tailwind CSS for all styling (inline styles OK for dynamic values only)
- Route handlers use factory functions (`createProviderRoutes(deps)`, etc.)

## Key Patterns

### Interface-First Design

Every service has an interface in `src/server/interfaces/`. Implementations live in `src/server/services/`. Route factories accept interfaces, not implementations. This enables testing with mocks.

```
interfaces/storage.ts   -->  IStorage
services/storage.ts     -->  JsonFileStorage implements IStorage
routes/providers.ts     -->  createProviderRoutes(storage: IStorage, logger: ILogger)
```

### FsAdapter

File system operations go through `FsAdapter` (defined in `services/fs-adapter.ts`). Tests inject a mock adapter instead of touching the real file system. The default adapter delegates to `node:fs/promises`.

### Route Factories

All route files export a factory function that takes dependencies and returns an Express Router:

```typescript
export function createProviderRoutes(storage: IStorage, logger: ILogger): Router { ... }
```

### SDK Integration

The `AiSdkRunner` calls `generateText()` from the Vercel AI SDK. The `model-factory.ts` creates provider-specific model instances based on `providerName` (anthropic, openai, google). Built-in tools are defined in `tools.ts` and enabled per scenario via `enabledTools`.

### Evaluation Split-Query Strategy

The `EvaluationOrchestrator` runs multiple queries per evaluation:

1. **Score query** (`buildScorePrompt`) -- Scores each dimension, compares answer, checks critical requirements
2. **Compliance query** (`buildCompliancePrompt`) -- Analyzes system prompt instruction compliance
3. **Debate rounds** (`buildDebatePrompt`) -- Optional multi-evaluator consensus
4. **Synthesis query** (`buildSynthesisPrompt`) -- Final weighted scores and confidence

Prompts are built in `eval-prompts.ts`, responses parsed in `eval-parsers.ts`.

## Data Storage

All data lives in `.model-test-bench/` in the project root:

```
.model-test-bench/
  providers/{id}.json           # Provider records (contains API keys -- gitignored)
  scenarios/custom/{id}.json    # User-created Scenario records
  runs/{id}.json                # Run records with full transcript
  evaluations/{id}.json         # Evaluation records with scores and compliance
  logs/mtb.log                  # JSON log file (rotated at 2MB, 25 files max)
```

This directory is in `.gitignore`. Never commit it.

## How Providers Work

A `Provider` defines how to connect to an LLM:

1. **providerName** -- `anthropic`, `openai`, or `google`
2. **model** -- Model identifier (e.g., `claude-sonnet-4-20250514`, `gpt-4o`, `gemini-2.0-flash`)
3. **apiKey** -- API key for the provider
4. **baseUrl** -- Optional custom base URL
5. **temperature**, **maxTokens**, **topP** -- Optional generation parameters
6. **timeoutSeconds** -- Request timeout

At run time, `model-factory.ts` creates the appropriate AI SDK model instance based on `providerName`.

## How Scenarios Work

A `Scenario` defines the task and its evaluation criteria:

- **prompt** -- The task given to the model
- **systemPrompt** -- System-level instructions (replaces the old CLAUDE.md concept)
- **enabledTools** -- Which built-in tools the model can use during execution
- **expectedAnswer** -- The ground truth answer for comparison
- **criticalRequirements** -- Must-pass checks (binary pass/fail with evidence)
- **gradingGuidelines** -- The LLM grading prompt. Tells the evaluator what to look for.
- **scoringDimensions** -- Named dimensions with weights (must sum to 1.0) and descriptions. Each is scored 0-10.

Categories: `planning`, `instruction-following`, `reasoning`, `tool-strategy`, `error-handling`, `ambiguity-handling`, `scope-management`, `custom`.

## How Evaluation Works

1. A completed Run is submitted for evaluation with one or more evaluator configs (each specifying a providerName, model, apiKey, and role).
2. The `EvaluationOrchestrator` formats the run transcript using `transcript-formatter.ts`.
3. The `instruction-parser.ts` splits the system prompt into individual testable instruction blocks.
4. Score query: Each evaluator scores each dimension and evaluates critical requirements.
5. Compliance query: Each evaluator reports which instructions were followed, violated, or not applicable.
6. Debate (optional): If multiple evaluators disagree, they exchange arguments for up to `maxRounds`.
7. Synthesis: Final scores are computed as weighted averages with confidence and dissent tracking.

The evaluation record stores everything: rounds, answer comparison, critical results, instruction compliance, synthesis, and cost ledger.

## Don't

- Don't add dependencies without checking `package.json` first
- Don't modify test files to make tests pass -- fix the source code
- Don't commit `.env` or `.model-test-bench/` data
- Don't use CSS modules or component libraries -- Tailwind only
- Don't create files over 300 lines -- split into sub-components or sub-modules
- Don't use `any` -- find or create proper types
- Don't suppress errors silently -- crashes are data
- Don't skip `.js` extensions in ESM imports
- Don't use `React.FC` -- use plain function components with explicit return types
- Don't store secrets in scenario or run JSON -- they belong in provider JSON only (which is gitignored)
