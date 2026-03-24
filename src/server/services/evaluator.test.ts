import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluationCallbacks } from '../interfaces/evaluator.js';
import type { Run, Scenario, TestSetup, EvaluationRequest, EvaluatorConfig, EvaluationStatus } from '../types/index.js';
import { makeSetup, makeScenario, makeRun, BASE_PROVIDER } from './storage-test-helpers.js';

// Mock the SDK — must be before importing the evaluator
const mockQueryFn = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQueryFn(...args),
}));
const { EvaluationOrchestrator } = await import('./evaluator.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkEval = (role: string): EvaluatorConfig => ({ provider: BASE_PROVIDER, role });

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
  ], ...o,
});

const mkSetup = (o: Partial<TestSetup> = {}): TestSetup => makeSetup({
  claudeMdFiles: [{ role: 'project', content: 'Always write tests first.' }],
  rules: [{ name: 'no-any', content: 'Never use TypeScript any.' }], ...o,
});

function mkCallbacks(): EvaluationCallbacks & { statuses: EvaluationStatus[] } {
  const statuses: EvaluationStatus[] = [];
  return { statuses, onStatusChange: vi.fn((s: EvaluationStatus) => statuses.push(s)) };
}

function mockQuery(text: string, cost = 0.01) {
  async function* gen() { yield { type: 'result', subtype: 'success', result: text, total_cost_usd: cost, num_turns: 1 }; }
  return gen();
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
      mockQueryFn.mockImplementation(() => {
        c++;
        if (c <= 2) return mockQuery(scoreJ({ correctness: 8, style: 7 }));
        if (c <= 4) return mockQuery(complianceJ());
        return mockQuery(synthesisJ());
      });
      const cb = mkCallbacks();
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest(), cb);
      expect(result.status).toBe('completed');
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].roundNumber).toBe(1);
      expect(result.synthesis.weightedTotal).toBeGreaterThan(0);
      expect(cb.statuses).toContain('running');
      expect(cb.statuses).toContain('completed');
    });

    it('builds ledger with cost tracking', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(scoreJ({ correctness: 9 }), 0.02));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest(), mkCallbacks());
      expect(result.ledger).toHaveLength(2);
      expect(result.ledger[0].evaluatorRole).toBe('primary');
      expect(result.ledger[0].totalCostUsd).toBeGreaterThan(0);
      expect(result.totalCostUsd).toBeGreaterThan(0);
    });
  });

  describe('multi-round with consensus', () => {
    it('stops early when consensus is reached', async () => {
      let c = 0;
      mockQueryFn.mockImplementation(() => {
        c++;
        if (c <= 2) return mockQuery(scoreJ({ correctness: 8, style: 7 }));
        if (c <= 4) return mockQuery(complianceJ());
        if (c <= 6) return mockQuery(debateJ('AGREE', { correctness: 8, style: 7 }));
        return mockQuery(synthesisJ());
      });
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ maxRounds: 3 }), mkCallbacks());
      expect(result.rounds.length).toBeLessThanOrEqual(3);
      expect(result.rounds[result.rounds.length - 1].consensusReached).toBe(true);
    });
  });

  describe('multi-round without consensus', () => {
    it('runs all rounds when evaluators disagree', async () => {
      let c = 0;
      mockQueryFn.mockImplementation(() => {
        c++;
        if (c <= 2) return mockQuery(scoreJ(c === 1 ? { correctness: 9, style: 8 } : { correctness: 5, style: 4 }));
        if (c <= 4) return mockQuery(complianceJ());
        if (c <= 6) return mockQuery(debateJ('DISAGREE', c === 5 ? { correctness: 9, style: 7 } : { correctness: 5, style: 5 }));
        return mockQuery(synthesisJ());
      });
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ maxRounds: 2 }), mkCallbacks());
      expect(result.rounds).toHaveLength(2);
      expect(result.synthesis).toBeDefined();
    });
  });

  describe('structured output parsing', () => {
    it('parses valid JSON responses into evaluation fields', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(scoreJ({ correctness: 9, style: 8 }, 0.95)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.similarity).toBeGreaterThan(0);
      expect(result.rounds[0].evaluations.length).toBeGreaterThan(0);
    });
  });

  describe('text-mode fallback', () => {
    it('handles non-JSON responses gracefully', async () => {
      mockQueryFn.mockImplementation(() => mockQuery('The overall weighted score is 7.5 out of 10.'));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
    });
  });

  describe('partial results handling', () => {
    it('produces valid evaluation with empty responses', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(''));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
      expect(result.synthesis).toBeDefined();
      expect(result.ledger).toHaveLength(1);
    });

    it('handles missing scores without errors', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(JSON.stringify({ summary: 'Looks good' })));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.status).toBe('completed');
      expect(result.answerComparison.similarity).toBe(0);
    });
  });

  describe('answer comparison', () => {
    it('marks answer as matching when closeness >= 0.7', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(scoreJ({ correctness: 9 }, 0.85)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.matches).toBe(true);
      expect(result.answerComparison.similarity).toBeCloseTo(0.85, 1);
    });

    it('marks answer as not matching when closeness < 0.7', async () => {
      mockQueryFn.mockImplementation(() => mockQuery(scoreJ({ correctness: 3 }, 0.3)));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      expect(result.answerComparison.matches).toBe(false);
    });
  });

  describe('critical requirements', () => {
    it('marks missed critical requirements', async () => {
      const missed = JSON.stringify({
        scores: { correctness: 5 }, overallCloseness: 0.4,
        missedCritical: ['Must validate input'], strengths: [], weaknesses: [], summary: 'Missed',
      });
      mockQueryFn.mockImplementation(() => mockQuery(missed));
      const result = await orch.evaluateRun(mkRun(), mkScenario(), mkSetup(), mkRequest({ evaluators: [mkEval('solo')], maxRounds: 1 }), mkCallbacks());
      const req = result.criticalResults.find((r) => r.requirement === 'Must validate input');
      expect(req?.met).toBe(false);
    });
  });
});
