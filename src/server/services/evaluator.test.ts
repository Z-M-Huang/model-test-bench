import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluationCallbacks } from '../interfaces/evaluator.js';
import type { Run, Scenario, Provider, EvaluationRequest, EvaluatorConfig, EvaluationStatus } from '../types/index.js';
import { makeProvider, makeScenario, makeRun } from './storage-test-helpers.js';

// Mock AI SDK
const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// Mock model factory
vi.mock('./model-factory.js', () => ({
  createModel: vi.fn(() => ({ modelId: 'mock-model' })),
}));

const { EvaluationOrchestrator } = await import('./evaluator.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_KEY = 'mock-value-for-testing';

const mkEval = (role: string): EvaluatorConfig => ({
  providerName: 'anthropic',
  model: 'claude-sonnet-4-6',
  apiKey: MOCK_KEY,
  role,
});

function mkRequest(overrides: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return { runId: 'run-1', evaluators: [mkEval('primary'), mkEval('secondary')], maxRounds: 1, ...overrides };
}

const mkRun = (o: Partial<Run> = {}): Run => makeRun({
  messages: [
    { timestamp: '2026-01-01T00:00:00Z', message: { type: 'assistant', message: { content: [{ type: 'text', text: 'I will help.' }] } } },
    { timestamp: '2026-01-01T00:00:01Z', message: { type: 'result', subtype: 'success', result: 'Done.' } },
  ], ...o,
});

const mkScenario = (o: Partial<Scenario> = {}): Scenario => makeScenario({
  expectedAnswer: 'The answer is 42',
  criticalRequirements: ['Must use correct formula', 'Must validate input'],
  scoringDimensions: [
    { name: 'correctness', weight: 0.6, description: 'Correct?' },
    { name: 'style', weight: 0.4, description: 'Well written?' },
  ],
  systemPrompt: 'Always write tests first.\nNever use TypeScript any.',
  ...o,
});

const mkProvider = (o: Partial<Provider> = {}): Provider => makeProvider({ ...o });

function mkCallbacks(): EvaluationCallbacks & { statuses: EvaluationStatus[] } {
  const statuses: EvaluationStatus[] = [];
  return { statuses, onStatusChange: vi.fn((s: EvaluationStatus) => statuses.push(s)), onProgress: vi.fn(), onMessage: vi.fn() };
}

function mockGenText(text: string) {
  return { text, usage: { promptTokens: 100, completionTokens: 50 } };
}

const scoreJ = (scores: Record<string, number>, closeness = 0.8) => JSON.stringify({
  scores, overallCloseness: closeness, missedCritical: [], strengths: ['Good'], weaknesses: ['Verbose'], summary: 'Solid',
});

const complianceJ = (c = 0.9) => JSON.stringify({
  results: [
    { instruction: 'Always write tests first.', status: 'followed', evidence: 'Present' },
    { instruction: 'Never use TypeScript any.', status: 'followed', evidence: 'None found' },
  ], overallCompliance: c,
});

const synthesisJ = () => JSON.stringify({ dimensionScores: { correctness: 8, style: 7 }, weightedTotal: 7.6, confidence: 0.85, dissenting: [] });
const debateJ = (v: string, s: Record<string, number>) => JSON.stringify({ verdict: v, updatedScores: s, critiques: [], reasoning: 'OK' });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvaluationOrchestrator', () => {
  let orch: InstanceType<typeof EvaluationOrchestrator>;
  beforeEach(() => { vi.clearAllMocks(); orch = new EvaluationOrchestrator(); });

  describe('single-round evaluation', () => {
    it('runs score + compliance queries per evaluator and synthesizes', async () => {
      let c = 0;
      mockGenerateText.mockImplementation(() => {
        c++;
        if (c <= 2) return mockGenText(scoreJ({ correctness: 8, style: 7 }));
        if (c <= 4) return mockGenText(complianceJ());
        return mockGenText(synthesisJ());
      });
      const cb = mkCallbacks();
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest(), cb);
      expect(result.status).toBe('completed');
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].roundNumber).toBe(1);
      expect(result.synthesis.weightedTotal).toBeGreaterThan(0);
      expect(cb.statuses).toContain('running');
      expect(cb.statuses).toContain('completed');
    });

    it('builds ledger with cost tracking', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(scoreJ({ correctness: 9 })));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest(), mkCallbacks());
      expect(result.ledger).toHaveLength(2);
      expect(result.ledger[0].evaluatorRole).toBe('primary');
      expect(result.totalCostUsd).toBe(0);
    });
  });

  describe('multi-round with consensus', () => {
    it('stops early when consensus is reached', async () => {
      let c = 0;
      mockGenerateText.mockImplementation(() => {
        c++;
        if (c <= 2) return mockGenText(scoreJ({ correctness: 8, style: 7 }));
        if (c <= 4) return mockGenText(complianceJ());
        if (c <= 6) return mockGenText(debateJ('AGREE', { correctness: 8, style: 7 }));
        return mockGenText(synthesisJ());
      });
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ maxRounds: 3 }), mkCallbacks());
      expect(result.rounds.length).toBeLessThanOrEqual(3);
      expect(result.rounds[result.rounds.length - 1].consensusReached).toBe(true);
    });
  });

  describe('multi-round without consensus', () => {
    it('runs all rounds when evaluators disagree', async () => {
      let c = 0;
      mockGenerateText.mockImplementation(() => {
        c++;
        if (c <= 2) return mockGenText(scoreJ(c === 1 ? { correctness: 9, style: 8 } : { correctness: 5, style: 4 }));
        if (c <= 4) return mockGenText(complianceJ());
        if (c <= 6) return mockGenText(debateJ('DISAGREE', c === 5 ? { correctness: 9, style: 7 } : { correctness: 5, style: 5 }));
        return mockGenText(synthesisJ());
      });
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ maxRounds: 2 }), mkCallbacks());
      expect(result.rounds).toHaveLength(2);
      expect(result.synthesis).toBeDefined();
    });
  });

  describe('structured output parsing', () => {
    it('parses valid JSON responses into evaluation fields', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(scoreJ({ correctness: 9, style: 8 }, 0.95)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.similarity).toBeGreaterThan(0);
      expect(result.rounds[0].evaluations.length).toBeGreaterThan(0);
    });
  });

  describe('text-mode fallback', () => {
    it('handles non-JSON responses gracefully', async () => {
      mockGenerateText.mockImplementation(() => mockGenText('The overall weighted score is 7.5 out of 10.'));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
    });
  });

  describe('partial results handling', () => {
    it('produces valid evaluation with empty responses', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(''));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
      expect(result.synthesis).toBeDefined();
      expect(result.ledger).toHaveLength(1);
    });

    it('handles missing scores without errors', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(JSON.stringify({ summary: 'Looks good' })));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
      expect(result.answerComparison.similarity).toBe(0);
    });
  });

  describe('answer comparison', () => {
    it('marks answer as matching when closeness >= 0.7', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(scoreJ({ correctness: 9 }, 0.85)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.matches).toBe(true);
      expect(result.answerComparison.similarity).toBeCloseTo(0.85, 1);
    });

    it('marks answer as not matching when closeness < 0.7', async () => {
      mockGenerateText.mockImplementation(() => mockGenText(scoreJ({ correctness: 3 }, 0.3)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.matches).toBe(false);
    });
  });

  describe('critical requirements', () => {
    it('marks missed critical requirements', async () => {
      const missed = JSON.stringify({
        scores: { correctness: 5 }, overallCloseness: 0.4,
        missedCritical: ['Must validate input'], strengths: [], weaknesses: [], summary: 'Missed',
      });
      mockGenerateText.mockImplementation(() => mockGenText(missed));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      const req = result.criticalResults.find((r) => r.requirement === 'Must validate input');
      expect(req?.met).toBe(false);
    });
  });

  describe('error handling', () => {
    it('propagates generateText errors', async () => {
      mockGenerateText.mockRejectedValue(new Error('Rate limit exceeded'));
      await expect(
        orch.evaluateRun(mkRun(), mkScenario(), mkProvider(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks()),
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
