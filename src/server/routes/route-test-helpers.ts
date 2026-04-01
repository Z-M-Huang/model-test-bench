import { vi } from 'vitest';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Provider, Scenario } from '../types/index.js';

const MOCK_KEY = 'mock-value-for-testing';

export function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Test Provider',
    description: 'A test provider',
    providerName: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: MOCK_KEY,
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
    prompt: 'Write a function',
    systemPrompt: '',
    enabledTools: [],
    expectedAnswer: 'done',
    criticalRequirements: [],
    gradingGuidelines: '',
    scoringDimensions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createMockStorage(): IStorage {
  return {
    getProvider: vi.fn(),
    listProviders: vi.fn(),
    saveProvider: vi.fn(),
    deleteProvider: vi.fn(),
    getScenario: vi.fn(),
    listScenarios: vi.fn(),
    saveScenario: vi.fn(),
    deleteScenario: vi.fn(),
    getRun: vi.fn(),
    listRuns: vi.fn(),
    saveRun: vi.fn(),
    deleteRun: vi.fn(),
    getEvaluation: vi.fn(),
    listEvaluations: vi.fn(),
    saveEvaluation: vi.fn(),
    deleteEvaluation: vi.fn(),
  };
}

export function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}
