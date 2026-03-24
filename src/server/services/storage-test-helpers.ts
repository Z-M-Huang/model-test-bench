import { vi } from 'vitest';
import type { FsAdapter } from './fs-adapter.js';
import type {
  TestSetup,
  Scenario,
  Run,
  Evaluation,
} from '../types/index.js';

// ─── Factory helpers ─────────────────────────────────────────────────

export const BASE_PROVIDER = {
  kind: 'api' as const,
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-test',
  model: 'claude-sonnet-4-6',
};

export function makeSetup(overrides: Partial<TestSetup> = {}): TestSetup {
  return {
    id: 'setup-1',
    name: 'Test Setup',
    description: 'A test setup',
    provider: BASE_PROVIDER,
    claudeMdFiles: [],
    rules: [],
    skills: [],
    subagents: [],
    mcpServers: [],
    permissionMode: 'default',
    maxTurns: 10,
    timeoutSeconds: 300,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'scenario-1',
    name: 'Test Scenario',
    category: 'coding',
    builtIn: false,
    prompt: 'Do something',
    workspaceFiles: [],
    expectedAnswer: 'done',
    criticalRequirements: [],
    gradingGuidelines: '',
    scoringDimensions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    setupId: 'setup-1',
    scenarioId: 'scenario-1',
    status: 'completed',
    setupSnapshot: makeSetup(),
    scenarioSnapshot: makeScenario(),
    messages: [],
    resultText: 'done',
    totalCostUsd: 0.01,
    durationMs: 1000,
    numTurns: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
    ...overrides,
  };
}

export function makeEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: 'eval-1',
    runId: 'run-1',
    status: 'completed',
    evaluators: [],
    rounds: [],
    answerComparison: { matches: true, explanation: 'Good', similarity: 0.9 },
    criticalResults: [],
    setupCompliance: {
      instructionCompliance: {
        followed: [],
        violated: [],
        notApplicable: [],
        overallCompliance: 1,
      },
      skillUsage: [],
      subagentUsage: [],
    },
    synthesis: {
      dimensionScores: new Map(),
      weightedTotal: 8,
      confidence: 0.9,
      dissenting: [],
    },
    ledger: [],
    totalCostUsd: 0.05,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:02.000Z',
    ...overrides,
  };
}

// ─── Mock FS ─────────────────────────────────────────────────────────

export interface MockFsState {
  files: Map<string, string>;
  dirs: Set<string>;
}

export function createMockFs(): { fs: FsAdapter; state: MockFsState } {
  const state: MockFsState = {
    files: new Map(),
    dirs: new Set(),
  };

  const mockFs: FsAdapter = {
    mkdir: vi.fn(async (dirPath: string) => {
      state.dirs.add(dirPath);
    }),

    writeFile: vi.fn(async (filePath: string, data: string) => {
      state.files.set(filePath, data);
    }),

    readFile: vi.fn(async (filePath: string) => {
      const data = state.files.get(filePath);
      if (data === undefined) {
        throw new Error(`ENOENT: no such file: ${filePath}`);
      }
      return data;
    }),

    readdir: vi.fn(async (dirPath: string) => {
      const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
      const entries: string[] = [];
      for (const key of state.files.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          if (!rest.includes('/')) {
            entries.push(rest);
          }
        }
      }
      return entries;
    }),

    unlink: vi.fn(async (filePath: string) => {
      if (!state.files.has(filePath)) {
        throw new Error(`ENOENT: no such file: ${filePath}`);
      }
      state.files.delete(filePath);
    }),

    rename: vi.fn(async (oldPath: string, newPath: string) => {
      const data = state.files.get(oldPath);
      if (data === undefined) {
        throw new Error(`ENOENT: no such file: ${oldPath}`);
      }
      state.files.set(newPath, data);
      state.files.delete(oldPath);
    }),

    stat: vi.fn(async (filePath: string) => {
      if (!state.files.has(filePath)) {
        throw new Error(`ENOENT: no such file: ${filePath}`);
      }
      return { isFile: () => true };
    }),

    access: vi.fn(async (filePath: string) => {
      if (!state.files.has(filePath)) {
        throw new Error(`ENOENT: no such file: ${filePath}`);
      }
    }),
  };

  return { fs: mockFs, state };
}
