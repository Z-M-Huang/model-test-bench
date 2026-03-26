import { vi } from 'vitest';
import type { FsAdapter } from './fs-adapter.js';
import type {
  Provider,
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

export function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Test Provider',
    description: 'A test provider',
    provider: BASE_PROVIDER,
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
    category: 'planning',
    claudeMdFiles: [],
    rules: [],
    skills: [],
    subagents: [],
    mcpServers: [],
    permissionMode: 'default',
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
    providerId: 'provider-1',
    scenarioId: 'scenario-1',
    status: 'completed',
    providerSnapshot: makeProvider(),
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
      dimensionScores: {},
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
    mkdir: vi.fn((_dirPath: string) => {
      state.dirs.add(_dirPath);
      return Promise.resolve();
    }),

    writeFile: vi.fn((_filePath: string, data: string) => {
      state.files.set(_filePath, data);
      return Promise.resolve();
    }),

    readFile: vi.fn((filePath: string) => {
      const data = state.files.get(filePath);
      if (data === undefined) {
        return Promise.reject(new Error(`ENOENT: no such file: ${filePath}`));
      }
      return Promise.resolve(data);
    }),

    readdir: vi.fn((dirPath: string) => {
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
      return Promise.resolve(entries);
    }),

    unlink: vi.fn((filePath: string) => {
      if (!state.files.has(filePath)) {
        return Promise.reject(new Error(`ENOENT: no such file: ${filePath}`));
      }
      state.files.delete(filePath);
      return Promise.resolve();
    }),

    rename: vi.fn((oldPath: string, newPath: string) => {
      const data = state.files.get(oldPath);
      if (data === undefined) {
        return Promise.reject(new Error(`ENOENT: no such file: ${oldPath}`));
      }
      state.files.set(newPath, data);
      state.files.delete(oldPath);
      return Promise.resolve();
    }),

    stat: vi.fn((filePath: string) => {
      if (!state.files.has(filePath)) {
        return Promise.reject(new Error(`ENOENT: no such file: ${filePath}`));
      }
      return Promise.resolve({ isFile: () => true });
    }),

    access: vi.fn((filePath: string) => {
      if (!state.files.has(filePath)) {
        return Promise.reject(new Error(`ENOENT: no such file: ${filePath}`));
      }
      return Promise.resolve();
    }),
  };

  return { fs: mockFs, state };
}
