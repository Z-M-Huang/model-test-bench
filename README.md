<p align="center">
  <img src="https://img.shields.io/badge/Claude_Test_Bench-Benchmark_Agent_Behavior-7c3aed?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyTDIgN2wxMCA1IDEwLTV6Ii8+PHBhdGggZD0iTTIgMTdsMTAgNSAxMC01Ii8+PHBhdGggZD0iTTIgMTJsMTAgNSAxMC01Ii8+PC9zdmc+" alt="Claude Test Bench" />
</p>

<p align="center">
  <strong>Do your CLAUDE.md instructions actually work? Now you can measure it.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/claude-test-bench"><img src="https://img.shields.io/npm/v/claude-test-bench?style=flat-square&color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/claude-test-bench"><img src="https://img.shields.io/npm/dm/claude-test-bench?style=flat-square&color=cb3837&logo=npm" alt="npm downloads" /></a>
  <a href="https://github.com/Z-M-Huang/claude-test-bench"><img src="https://img.shields.io/github/stars/Z-M-Huang/claude-test-bench?style=flat-square&logo=github" alt="GitHub stars" /></a>
  <a href="https://github.com/Z-M-Huang/claude-test-bench/issues"><img src="https://img.shields.io/github/issues/Z-M-Huang/claude-test-bench?style=flat-square&logo=github" alt="GitHub issues" /></a>
  <a href="https://github.com/Z-M-Huang/claude-test-bench/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Z-M-Huang/claude-test-bench?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/tests-357-brightgreen?style=flat-square" alt="357 Tests" />
  <img src="https://visitor-badge.laobi.icu/badge?page_id=Z-M-Huang.claude-test-bench&style=flat-square" alt="Visitors" />
</p>

<p align="center">
  <a href="#what-it-does">What It Does</a> &nbsp;&middot;&nbsp;
  <a href="#use-cases">Use Cases</a> &nbsp;&middot;&nbsp;
  <a href="#quick-start">Quick Start</a> &nbsp;&middot;&nbsp;
  <a href="#built-in-test-suites">Test Suites</a> &nbsp;&middot;&nbsp;
  <a href="#how-evaluation-works">Evaluation</a> &nbsp;&middot;&nbsp;
  <a href="#core-concepts">Concepts</a> &nbsp;&middot;&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;&middot;&nbsp;
  <a href="#development">Dev</a>
</p>

---

## What It Does

Claude Test Bench is a local benchmarking tool for testing AI agent configurations using the Claude Agent SDK. You define a **Provider** (connection credentials + model), pair it with a **Scenario** (task, agent config, workspace files, and grading rubric), run it, and evaluate the results through a web UI — with LLM-based grading that tracks which specific instructions were followed, violated, or deemed not applicable.

The core insight: **writing CLAUDE.md instructions is easy, but knowing whether they actually change agent behavior is hard.** Claude Test Bench solves this by running controlled experiments and grading the results with a multi-stage evaluation pipeline.

```
Provider (credentials + model)  ──────────────────────┐
                                                       ├──▶  Run (SDK query)  ──▶  Evaluation
Scenario (prompt + CLAUDE.md + agent config + rubric)  ┘
```

## Use Cases

| Use Case | What You Test | What You Learn |
|----------|--------------|----------------|
| **CLAUDE.md A/B Testing** | Same task with and without CLAUDE.md | Whether your instructions actually change agent behavior |
| **Model Comparison** | Same scenario across Sonnet, Opus, etc. | Which model reasons best for your specific task |
| **Skill & Subagent Testing** | Skill and subagent definitions in a scenario | Whether your custom tools work as intended |
| **Instruction Effectiveness** | Individual CLAUDE.md rules | Which specific instructions were followed vs. ignored |
| **Regression Testing** | Same scenario across code changes | Whether prompt/config changes improve or degrade quality |
| **Evaluation Calibration** | Same run with different evaluator configs | Whether your grading rubric produces consistent scores |

## Quick Start

### Install from npm

```bash
npm install -g claude-test-bench
claude-test-bench
# Opens browser at http://localhost:3847
```

### Or run from source

```bash
git clone https://github.com/Z-M-Huang/claude-test-bench.git
cd claude-test-bench
npm install
npm run build && node dist/bin/ctb.js
```

Once the UI opens:

1. **Create a Provider** — Add your API key, base URL, and model on the Providers page
2. **Pick a Scenario** — 8 built-in scenarios are seeded on first launch, or create your own
3. **Run** — Pair a provider with a scenario and execute
4. **Evaluate** — Grade the completed run with an LLM evaluator

CLI flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--port N` | 3847 | HTTP port |
| `--log-level` | info | debug, info, warn, error |
| `--open` / `--no-open` | `--open` | Auto-open browser on launch |

## Built-in Test Suites

Claude Test Bench ships with 8 ready-to-run scenarios in 4 paired suites. Each pair has a **baseline** (no CLAUDE.md) and an **instruction-guided** version (with CLAUDE.md) so you can directly measure instruction effectiveness.

| Suite | Baseline Category | With CLAUDE.md Category | What It Tests | Key Trap |
|-------|-------------------|-------------------------|---------------|----------|
| **Migration Planning** | `reasoning` | `reasoning` | Critical path reasoning under time constraints | Naive sequential scheduling misses the window |
| **Car Wash Test** | `reasoning` | `instruction-following` | Goal-oriented physical reasoning | Recommending walking 50m instead of driving the car to the car wash |
| **Negative Analysis** | `reasoning` | `instruction-following` | Failure-first evaluation of a startup pitch | Sycophantic "looks great!" response vs. structured risk analysis |
| **Golden Rules** | `instruction-following` | `instruction-following` | Auth refactor with 7 deliberate traps | Sycophancy bait, fake dead code, timing attack, push-to-main |

Each suite is in `docs/schemas/` and auto-seeds on first launch. The instruction-guided versions include CLAUDE.md content designed to improve performance on that specific task — the evaluation then measures whether the instructions were actually effective.

## How Evaluation Works

Every completed run is graded by an LLM evaluator using a **split-query strategy** — multiple focused queries instead of one monolithic prompt:

```
Run Transcript
     │
     ▼
┌─────────────────┐     ┌──────────────────┐
│  1. Score Query  │     │ 2. Compliance    │
│                  │     │    Query         │
│ • Dimension      │     │                  │
│   scores (0-10)  │     │ • Instruction    │
│ • Answer         │     │   compliance     │
│   comparison     │     │   (followed /    │
│ • Critical       │     │    violated /    │
│   requirements   │     │    not_applicable│
│                  │     │    per rule)     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          3. Debate Rounds               │
│  (optional, multi-evaluator consensus)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          4. Synthesis Query             │
│  Final weighted scores + confidence     │
│  + dissenting opinions                  │
└─────────────────────────────────────────┘
```

The evaluation produces:

- **Per-dimension scores** (0-10) for each scoring dimension
- **Answer comparison** — match status, similarity (0-1), explanation
- **Critical requirement results** — binary pass/fail with evidence
- **Instruction compliance report** — each CLAUDE.md instruction classified as `followed`, `violated`, or `not_applicable`
- **Strengths and weaknesses** — summary assessment from the evaluator
- **Weighted total score** with confidence level and dissent tracking
- **Cost tracking** — aggregated API cost per evaluator

## Core Concepts

### Provider

A **Provider** defines how to connect to an LLM. It contains only connection credentials and model configuration:

```json
{
  "name": "Sonnet via API",
  "description": "Anthropic API with claude-sonnet-4-6",
  "provider": {
    "kind": "api",
    "baseUrl": "https://api.anthropic.com",
    "apiKey": "<ANTHROPIC_API_KEY>",
    "model": "claude-sonnet-4-6"
  },
  "timeoutSeconds": 300
}
```

Providers support two auth modes: `api` (API key + base URL) and `oauth` (OAuth token). See `docs/schemas/provider.example.json`, `docs/schemas/provider-oauth.example.json`, and `docs/schemas/provider-api.example.json`.

> **Security note:** Provider JSON files are stored in `.claude-test-bench/providers/` which is gitignored. Credentials are stored locally in plaintext and transmitted to the configured provider endpoint at run time.

### Scenario

A **Scenario** defines the complete test: the task, agent configuration, workspace, and grading rubric. Agent behavior settings (CLAUDE.md, rules, skills, subagents, MCP servers, permissions) live here — not on the provider — so you can test the same model with different configurations.

```json
{
  "name": "Migration Planning Scenario",
  "category": "reasoning",
  "claudeMdFiles": [
    { "role": "project", "content": "# Rules\n- Always calculate the critical path first" }
  ],
  "rules": [],
  "skills": [],
  "subagents": [],
  "mcpServers": [],
  "permissionMode": "acceptEdits",
  "allowedTools": ["Read", "Write", "Edit"],
  "prompt": "Read migration_plan.md and create an optimal schedule...",
  "workspaceFiles": [{ "path": "migration_plan.md", "content": "..." }],
  "expectedAnswer": "The migration CANNOT fit in the 4-hour window...",
  "criticalRequirements": ["Must identify the window is exceeded"],
  "gradingGuidelines": "Grade on correctness, reasoning quality...",
  "scoringDimensions": [
    { "name": "Correctness", "weight": 0.4, "description": "..." }
  ]
}
```

Key fields:

| Field | Purpose |
|-------|---------|
| `claudeMdFiles` | CLAUDE.md entries (project and/or user role) written to the workspace |
| `rules`, `skills`, `subagents` | Named agent configuration entries |
| `mcpServers` | MCP server configs (stdio, http, or sse transport) |
| `permissionMode` | SDK permission mode (`default`, `acceptEdits`, `bypassPermissions`, `plan`, `dontAsk`) |
| `allowedTools` / `disallowedTools` | Tool allow/deny lists |
| `maxTurns` | Maximum conversation turns |
| `prompt` | The task given to the agent |
| `workspaceFiles` | Files written to a temp directory before execution |
| `expectedAnswer` | Ground truth for comparison |
| `criticalRequirements` | Must-pass checks (binary pass/fail) |
| `gradingGuidelines` | The LLM grading prompt — tells the evaluator what to look for |
| `scoringDimensions` | Named dimensions with weights (must sum to 1.0), each scored 0-10 |

Categories: `planning`, `instruction-following`, `reasoning`, `tool-strategy`, `error-handling`, `ambiguity-handling`, `scope-management`, `custom`.

See `docs/schemas/scenario.example.json` and `docs/schemas/scenario-baseline.example.json` for complete examples.

### Run

A **Run** pairs one Provider with one Scenario. The Claude Agent SDK's `query()` function executes the scenario prompt inside an isolated temp workspace with the scenario's agent configuration (CLAUDE.md, rules, skills, etc.). The full execution transcript — tool calls, thinking, output — is captured and stored.

### Evaluation

An **Evaluation** grades a completed Run using the [split-query strategy](#how-evaluation-works) described above. One or more LLM evaluators read the full transcript and produce scores, compliance reports, and a synthesized verdict.

## How to Test CLAUDE.md Effectiveness

### Step 1: Create a Provider

Create a provider with your API credentials on the Providers page, or write JSON to `.claude-test-bench/providers/{id}.json`.

### Step 2: Create two Scenarios — baseline and with instructions

**Baseline** (no CLAUDE.md):
```json
{
  "name": "Migration Baseline",
  "claudeMdFiles": [],
  "prompt": "Read migration_plan.md and create an optimal schedule...",
  "...": "..."
}
```

**With instructions** (CLAUDE.md configured):
```json
{
  "name": "Migration With Instructions",
  "claudeMdFiles": [{
    "role": "project",
    "content": "# Reasoning Guidelines\n\n1. Always calculate the critical path before proposing a schedule\n2. Verify all constraints are satisfied before declaring success\n3. If a constraint cannot be met, state this clearly rather than forcing a solution\n4. Show all arithmetic work"
  }],
  "prompt": "Read migration_plan.md and create an optimal schedule...",
  "...": "..."
}
```

Both scenarios should have identical prompts, workspace files, and grading criteria — only the `claudeMdFiles` differ.

### Step 3: Write instruction-aware grading guidelines

Write `gradingGuidelines` that evaluate both correctness AND whether each CLAUDE.md instruction visibly influenced behavior. See `docs/schemas/scenario-with-claude-md.example.json` for a full example.

### Step 4: Run both scenarios against the same provider

Use the Run page to execute each scenario with your provider.

### Step 5: Evaluate and compare

Evaluate both runs. The compliance query will report which instructions were `followed`, `violated`, or `not_applicable`. Compare the two evaluation reports to see whether instructions changed behavior and improved scores.

## Creating Providers & Scenarios

You can create providers and scenarios through the web UI or by writing JSON files directly:

- **Via UI** — Navigate to the Providers or Scenarios page in the web interface
- **Via JSON** — Write files to `.claude-test-bench/providers/{id}.json` or `.claude-test-bench/scenarios/custom/{id}.json`
- **Via AI** — Ask an AI assistant to generate JSON matching the schemas in `docs/schemas/`

Reference examples:

| File | Description |
|------|-------------|
| `docs/schemas/provider.example.json` | API provider with CLAUDE.md |
| `docs/schemas/provider-oauth.example.json` | OAuth provider (baseline) |
| `docs/schemas/provider-api.example.json` | API provider with reasoning instructions |
| `docs/schemas/scenario.example.json` | Multi-file refactor scenario |
| `docs/schemas/scenario-baseline.example.json` | Migration scenario (baseline grading) |
| `docs/schemas/scenario-with-claude-md.example.json` | Migration scenario (instruction-aware grading) |
| `docs/schemas/scenario-carwash-baseline.example.json` | Car Wash Test (baseline) |
| `docs/schemas/scenario-carwash-with-claude-md.example.json` | Car Wash Test (with goal-first reasoning) |
| `docs/schemas/scenario-negative-analysis-baseline.example.json` | Startup evaluation (baseline) |
| `docs/schemas/scenario-negative-analysis-with-claude-md.example.json` | Startup evaluation (with negative-first framework) |
| `docs/schemas/scenario-golden-rules-baseline.example.json` | Auth refactor with 7 traps (baseline) |
| `docs/schemas/scenario-golden-rules-with-claude-md.example.json` | Auth refactor with 7 traps (with Golden CLAUDE.md) |

## Data Storage & Security

All data lives in `.claude-test-bench/` in the current working directory (typically the repo root):

```
.claude-test-bench/
  providers/{id}.json           # Provider records (contains API keys)
  scenarios/custom/{id}.json    # User-created scenarios
  runs/{id}.json                # Run records with full transcript
  evaluations/{id}.json         # Evaluation records with scores
  logs/ctb.log                  # JSON log file (rotated at 2MB, 25 files max)
```

> **This entire directory is gitignored.** Credentials are stored locally in plaintext and transmitted to the configured provider endpoint at run time. Never commit `.claude-test-bench/` or `.env` files.

## Architecture

```
bin/ctb.ts  ──▶  Express app (src/server/index.ts)  ──▶  React SPA (src/web/)
                      │
         IStorage  IRunner  IEvaluator  ILogger  IWorkspaceBuilder
            │          │         │          │          │
     JsonFileStorage  ScenarioRunner  EvaluationOrchestrator  JsonLogger  WorkspaceBuilder
            │          │         │
     .claude-test-bench/   SDK query()   SDK query() (split-query eval)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Express 5, Node.js (ESM) |
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| Build | TypeScript 5, Vite 6 |
| Agent SDK | `@anthropic-ai/claude-agent-sdk` (query, streaming) |
| Testing | Vitest (unit), Playwright (E2E), Supertest (routes) |
| Storage | File-based JSON in `.claude-test-bench/` |
| Streaming | Server-Sent Events (SSE) for run and eval progress |

### Design Patterns

- **Interface-first** — Every service has an interface in `src/server/interfaces/`. Route factories accept interfaces, not implementations. This enables testing with mocks.
- **Route factories** — All route files export `createXxxRoutes(deps)` returning an Express Router.
- **FsAdapter** — File system operations go through an adapter for testability.
- **Workspace isolation** — Each run gets its own temp directory with CLAUDE.md, rules, skills, and workspace files.

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint (source files)
npm run lint

# Format (source files)
npm run format

# Dev mode (watch server TypeScript compilation)
npm run dev

# Build everything (server + web)
npm run build
```

> `npm run dev` watches only the server TypeScript. For frontend development, use `npx vite dev` in the `src/web/` directory or run `npm run build:web` after changes.

## Project Structure

```
claude-test-bench/
  bin/
    ctb.ts                          # CLI entry point (port, log-level, --open/--no-open)
  docs/
    schemas/                        # Example JSON for providers and scenarios
  e2e/                              # Playwright end-to-end tests
  src/
    server/
      index.ts                      # Express app factory (createApp)
      interfaces/
        evaluator.ts                # IEvaluator
        logger.ts                   # ILogger
        runner.ts                   # IRunner
        storage.ts                  # IStorage
        workspace.ts                # IWorkspaceBuilder
      routes/
        providers.ts                # /api/providers CRUD
        scenarios.ts                # /api/scenarios CRUD
        runs.ts                     # /api/runs + run execution
        evaluations.ts              # /api/evaluations + eval pipeline
        run-queue.ts                # Run queue management
        eval-queue.ts               # Eval queue management
        run-sse.ts                  # SSE streaming for run progress
      services/
        storage.ts                  # JsonFileStorage (file-based JSON)
        runner.ts                   # ScenarioRunner (SDK query())
        evaluator.ts                # EvaluationOrchestrator (split-query eval)
        workspace.ts                # WorkspaceBuilder (temp dir per run)
        agent-mapper.ts             # Scenario types -> SDK option types
        env-builder.ts              # Provider config -> env vars
        eval-prompts.ts             # Prompt builders for eval queries
        eval-parsers.ts             # Response parsers for eval results
        eval-parsers-debate-impl.ts # Debate round parsing
        eval-helpers.ts             # Consensus, answer comparison, compliance merge
        instruction-parser.ts       # Splits CLAUDE.md into testable blocks
        transcript-formatter.ts     # Formats run messages for eval context
        fs-adapter.ts               # File system abstraction for testing
        logger.ts                   # JsonLogger with file output
        log-rotator.ts              # Log rotation (2MB/file, 25 files max)
        seeder.ts                   # Seed storage on first launch
      types/
        provider.ts                 # Provider, ProviderConfig, ClaudeMdEntry, etc.
        scenario.ts                 # Scenario, WorkspaceFile, ScenarioCategory
        run.ts                      # Run, RunStatus, SDKMessageRecord
        evaluation.ts               # Evaluation, EvaluationRound, InstructionCompliance
        index.ts                    # Re-exports
    web/
      src/
        App.tsx                     # React router (all page routes)
        api.ts                      # API client
        main.tsx                    # Entry point
        index.css                   # Tailwind CSS entry
        components/                 # Shared UI components
        hooks/                      # Shared React hooks (useLiveProcess, etc.)
        pages/
          Dashboard.tsx             # /
          ProviderList.tsx          # /providers
          ProviderEditor.tsx        # /providers/new, /providers/:id/edit
          ScenarioList.tsx          # /scenarios
          ScenarioEditor.tsx        # /scenarios/new, /scenarios/:id
          RunPage.tsx               # /run
          RunHistory.tsx            # /history (split-panel with eval sidebar)
          RunDetail.tsx             # /runs/:id
          EvalConfig.tsx            # /runs/:id/evaluate
          ReportView.tsx            # /evaluations/:id
  .env.example                      # Environment template
  package.json                      # Scripts, deps, bin entries
  tsconfig.json                     # Base TypeScript config
  tsconfig.server.json              # Server build config
  tsconfig.bin.json                 # CLI build config
  vite.config.ts                    # Vite config (web build)
  vitest.config.ts                  # Test runner config
  playwright.config.ts              # E2E test config
  tailwind.config.ts                # Tailwind configuration
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/Z-M-Huang/claude-test-bench.git
cd claude-test-bench
npm install
npm test
npm run build
npm run lint
```

## License

[ISC](LICENSE)

---

<p align="center">
  <sub>Built for testing Claude Code agent configurations. Not affiliated with or endorsed by Anthropic.</sub>
</p>
