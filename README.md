<p align="center">
  <img src="https://img.shields.io/badge/Model_Test_Bench-Benchmark_LLM_Behavior-7c3aed?style=for-the-badge" alt="Model Test Bench" />
</p>

<p align="center">
  <strong>Do your system prompts actually work? Now you can measure it.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/model-test-bench"><img src="https://img.shields.io/npm/v/model-test-bench?style=flat-square&color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/model-test-bench"><img src="https://img.shields.io/npm/dm/model-test-bench?style=flat-square&color=cb3837&logo=npm" alt="npm downloads" /></a>
  <a href="https://github.com/Z-M-Huang/model-test-bench"><img src="https://img.shields.io/github/stars/Z-M-Huang/model-test-bench?style=flat-square&logo=github" alt="GitHub stars" /></a>
  <a href="https://github.com/Z-M-Huang/model-test-bench/issues"><img src="https://img.shields.io/github/issues/Z-M-Huang/model-test-bench?style=flat-square&logo=github" alt="GitHub issues" /></a>
  <a href="https://github.com/Z-M-Huang/model-test-bench/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Z-M-Huang/model-test-bench?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" alt="Express 5" />
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

Model Test Bench is a local benchmarking tool for testing LLM configurations across multiple providers. You define a **Provider** (API credentials + model), pair it with a **Scenario** (task, system prompt, and grading rubric), run it, and evaluate the results through a web UI -- with LLM-based grading that tracks which specific instructions were followed, violated, or deemed not applicable.

Supports **Anthropic**, **OpenAI**, and **Google** models out of the box via the Vercel AI SDK.

```
Provider (credentials + model)  ─────────────────┐
                                                   ├──▶  Run (generateText)  ──▶  Evaluation
Scenario (prompt + system prompt + rubric)         ┘
```

## Use Cases

| Use Case | What You Test | What You Learn |
|----------|--------------|----------------|
| **System Prompt A/B Testing** | Same task with and without system prompt | Whether your instructions actually change model behavior |
| **Model Comparison** | Same scenario across GPT-4o, Sonnet, Gemini | Which model reasons best for your specific task |
| **Provider Comparison** | Same model via different API endpoints | Whether provider routing affects quality |
| **Instruction Effectiveness** | Individual system prompt rules | Which specific instructions were followed vs. ignored |
| **Regression Testing** | Same scenario across prompt changes | Whether updates improve or degrade quality |
| **Evaluation Calibration** | Same run with different evaluator configs | Whether your grading rubric produces consistent scores |

## Quick Start

### Install from npm

```bash
npm install -g model-test-bench
mtb
# Opens browser at http://localhost:3847
```

Or run without installing:

```bash
npx model-test-bench
```

### Run from source

```bash
git clone https://github.com/Z-M-Huang/model-test-bench.git
cd model-test-bench
npm install
npm run build && node dist/bin/mtb.js
```

Once the UI opens:

1. **Create a Provider** -- Add your API key, select a provider (Anthropic, OpenAI, or Google), and choose a model
2. **Pick a Scenario** -- 8 built-in scenarios are seeded on first launch, or create your own
3. **Run** -- Pair a provider with a scenario and execute
4. **Evaluate** -- Grade the completed run with an LLM evaluator

CLI flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--port N` | 3847 | HTTP port |
| `--log-level` | info | debug, info, warn, error |
| `--open` / `--no-open` | `--open` | Auto-open browser on launch |

## Built-in Test Suites

Model Test Bench ships with 8 ready-to-run scenarios in 4 paired suites. Each pair has a **baseline** (no system prompt) and an **instruction-guided** version (with system prompt) so you can directly measure instruction effectiveness.

| Suite | Baseline Category | With System Prompt | What It Tests | Key Trap |
|-------|-------------------|---------------------|---------------|----------|
| **Migration Planning** | `reasoning` | `reasoning` | Critical path reasoning under time constraints | Naive sequential scheduling misses the window |
| **Car Wash Test** | `reasoning` | `instruction-following` | Goal-oriented physical reasoning | Recommending walking instead of driving the car to the car wash |
| **Negative Analysis** | `reasoning` | `instruction-following` | Failure-first evaluation of a startup pitch | Sycophantic "looks great!" response vs. structured risk analysis |
| **Golden Rules** | `instruction-following` | `instruction-following` | Auth refactor with 7 deliberate traps | Sycophancy bait, fake dead code, timing attack, push-to-main |

Each suite is in `docs/schemas/` and auto-seeds on first launch.

## How Evaluation Works

Every completed run is graded by an LLM evaluator using a **split-query strategy** -- multiple focused queries instead of one monolithic prompt:

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
- **Answer comparison** -- match status, similarity (0-1), explanation
- **Critical requirement results** -- binary pass/fail with evidence
- **Instruction compliance report** -- each system prompt instruction classified as `followed`, `violated`, or `not_applicable`
- **Strengths and weaknesses** -- summary assessment from the evaluator
- **Weighted total score** with confidence level and dissent tracking
- **Cost tracking** -- aggregated API cost per evaluator

## Core Concepts

### Provider

A **Provider** defines how to connect to an LLM. It contains connection credentials and model configuration:

```json
{
  "name": "Anthropic Sonnet",
  "description": "Anthropic Claude Sonnet via API",
  "providerName": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKey": "<ANTHROPIC_API_KEY>",
  "baseUrl": "https://api.anthropic.com",
  "timeoutSeconds": 300
}
```

Supported providers: `anthropic`, `openai`, `google`.

> **Security note:** Provider JSON files are stored in `.model-test-bench/providers/` which is gitignored. Credentials are stored locally in plaintext and transmitted to the configured provider endpoint at run time.

### Scenario

A **Scenario** defines the complete test: the task, system prompt, and grading rubric.

```json
{
  "name": "Migration Planning Scenario",
  "category": "reasoning",
  "prompt": "Analyze the migration plan and create an optimal schedule...",
  "systemPrompt": "Always calculate the critical path before proposing a schedule.",
  "enabledTools": [],
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
| `prompt` | The task given to the model |
| `systemPrompt` | System-level instructions that shape model behavior |
| `enabledTools` | Built-in tools available during execution |
| `expectedAnswer` | Ground truth for comparison |
| `criticalRequirements` | Must-pass checks (binary pass/fail) |
| `gradingGuidelines` | The LLM grading prompt -- tells the evaluator what to look for |
| `scoringDimensions` | Named dimensions with weights (must sum to 1.0), each scored 0-10 |

Categories: `planning`, `instruction-following`, `reasoning`, `tool-strategy`, `error-handling`, `ambiguity-handling`, `scope-management`, `custom`.

### Run

A **Run** pairs one Provider with one Scenario. The Vercel AI SDK's `generateText()` function executes the scenario prompt with the scenario's system prompt. The full execution transcript -- tool calls, output -- is captured and stored.

### Evaluation

An **Evaluation** grades a completed Run using the [split-query strategy](#how-evaluation-works) described above. One or more LLM evaluators read the full transcript and produce scores, compliance reports, and a synthesized verdict.

## Data Storage & Security

All data lives in `.model-test-bench/` in the current working directory:

```
.model-test-bench/
  providers/{id}.json           # Provider records (contains API keys)
  scenarios/custom/{id}.json    # User-created scenarios
  runs/{id}.json                # Run records with full transcript
  evaluations/{id}.json         # Evaluation records with scores
  logs/mtb.log                  # JSON log file (rotated at 2MB, 25 files max)
```

> **This entire directory is gitignored.** Credentials are stored locally in plaintext. Never commit `.model-test-bench/` or `.env` files.

## Architecture

```
bin/mtb.ts  ──▶  Express app (src/server/index.ts)  ──▶  React SPA (src/web/)
                      │
         IStorage  IRunner  IEvaluator  ILogger
            │          │         │          │
     JsonFileStorage  AiSdkRunner  EvaluationOrchestrator  JsonLogger
            │          │         │
     .model-test-bench/   generateText()   generateText() (split-query eval)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Express 5, Node.js (ESM) |
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| Build | TypeScript 5, Vite 6 |
| AI SDK | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) |
| Testing | Vitest (unit), Playwright (E2E), Supertest (routes) |
| Storage | File-based JSON in `.model-test-bench/` |
| Streaming | Server-Sent Events (SSE) for run and eval progress |

### Design Patterns

- **Interface-first** -- Every service has an interface in `src/server/interfaces/`. Route factories accept interfaces, not implementations.
- **Route factories** -- All route files export `createXxxRoutes(deps)` returning an Express Router.
- **FsAdapter** -- File system operations go through an adapter for testability.
- **Model Factory** -- `model-factory.ts` creates provider-specific AI SDK model instances from a `providerName` + config.

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
model-test-bench/
  bin/
    mtb.ts                            # CLI entry point (port, log-level, --open/--no-open)
  docs/
    schemas/                          # Example JSON for providers and scenarios
  e2e/                                # Playwright end-to-end tests
  src/
    server/
      index.ts                        # Express app factory (createApp)
      interfaces/
        evaluator.ts                  # IEvaluator
        logger.ts                     # ILogger
        runner.ts                     # IRunner
        storage.ts                    # IStorage
      routes/
        providers.ts                  # /api/providers CRUD
        scenarios.ts                  # /api/scenarios CRUD
        runs.ts                       # /api/runs + run execution
        evaluations.ts                # /api/evaluations + eval pipeline
        run-queue.ts                  # Run queue management
        eval-queue.ts                 # Eval queue management
        run-sse.ts                    # SSE streaming for run progress
      services/
        storage.ts                    # JsonFileStorage (file-based JSON)
        runner.ts                     # AiSdkRunner (Vercel AI SDK generateText)
        evaluator.ts                  # EvaluationOrchestrator (split-query eval)
        model-factory.ts              # Creates AI SDK model from provider config
        tools.ts                      # Built-in tool definitions
        eval-prompts.ts               # Prompt builders for eval queries
        eval-parsers.ts               # Response parsers for eval results
        eval-parsers-debate-impl.ts   # Debate round parsing
        eval-helpers.ts               # Consensus, answer comparison, compliance merge
        instruction-parser.ts         # Splits system prompt into testable blocks
        transcript-formatter.ts       # Formats run messages for eval context
        fs-adapter.ts                 # File system abstraction for testing
        logger.ts                     # JsonLogger with file output
        log-rotator.ts                # Log rotation (2MB/file, 25 files max)
        seeder.ts                     # Seed storage on first launch
      types/
        provider.ts                   # Provider, ScoringDimension
        scenario.ts                   # Scenario, ScenarioCategory
        run.ts                        # Run, RunStatus, SDKMessageRecord
        evaluation.ts                 # Evaluation, EvaluationRound, InstructionCompliance
        index.ts                      # Re-exports
    web/
      src/
        App.tsx                       # React router (all page routes)
        api.ts                        # API client
        main.tsx                      # Entry point
        index.css                     # Tailwind CSS entry
        components/                   # Shared UI components
        hooks/                        # Shared React hooks (useLiveProcess, etc.)
        pages/
          Dashboard.tsx               # /
          ProviderList.tsx            # /providers
          ProviderEditor.tsx          # /providers/new, /providers/:id/edit
          ScenarioList.tsx            # /scenarios
          ScenarioEditor.tsx          # /scenarios/new, /scenarios/:id
          RunPage.tsx                 # /run
          RunHistory.tsx              # /history
          RunDetail.tsx               # /runs/:id
          EvalConfig.tsx              # /runs/:id/evaluate
          ReportView.tsx              # /evaluations/:id
  .env.example                        # Environment template
  package.json                        # Scripts, deps, bin entries
  tsconfig.json                       # Base TypeScript config
  tsconfig.server.json                # Server build config
  tsconfig.bin.json                   # CLI build config
  vite.config.ts                      # Vite config (web build)
  vitest.config.ts                    # Test runner config
  playwright.config.ts                # E2E test config
  tailwind.config.ts                  # Tailwind configuration
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/Z-M-Huang/model-test-bench.git
cd model-test-bench
npm install
npm test
npm run build
npm run lint
```

## License

[Apache-2.0](LICENSE)

---

<p align="center">
  <sub>Built for testing LLM configurations across providers. Not affiliated with or endorsed by any AI provider.</sub>
</p>
