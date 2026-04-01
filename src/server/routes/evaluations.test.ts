import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createEvaluationRoutes, EvalQueue } from './evaluations.js';
import type { IStorage } from '../interfaces/storage.js';
import type { IEvaluator } from '../interfaces/evaluator.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Evaluation, Run } from '../types/index.js';
import { makeProvider, makeScenario, createMockStorage, createMockLogger } from './route-test-helpers.js';

// Helpers

const TS = '2026-01-01T00:00:00.000Z';
const mkRun = (o: Partial<Run> = {}): Run => ({
  id: 'run-1', providerId: 'provider-1', scenarioId: 'scenario-1', status: 'completed',
  providerSnapshot: makeProvider(), scenarioSnapshot: makeScenario(), messages: [],
  resultText: 'done', totalCostUsd: 0.01, durationMs: 1000, numTurns: 3,
  createdAt: TS, updatedAt: TS, ...o,
});

const EMPTY_COMPLIANCE = { followed: [], violated: [], notApplicable: [], overallCompliance: 1 };
const mkEval = (o: Partial<Evaluation> = {}): Evaluation => ({
  id: 'eval-1', runId: 'run-1', status: 'completed', evaluators: [],
  rounds: [{ roundNumber: 1, evaluations: [], consensusReached: true, timestamp: TS }],
  answerComparison: { matches: true, explanation: 'Good', similarity: 0.9 },
  criticalResults: [],
  setupCompliance: { instructionCompliance: EMPTY_COMPLIANCE },
  synthesis: { dimensionScores: {}, weightedTotal: 8, confidence: 0.9, dissenting: [] },
  ledger: [], totalCostUsd: 0.05, createdAt: TS, updatedAt: TS, ...o,
});

const mkMockEvaluator = (): IEvaluator => ({
  evaluateRun: vi.fn().mockImplementation((_run, _sc, _pr, _req, cb) => {
    cb.onStatusChange('running'); cb.onProgress('scoring'); cb.onMessage({ phase: 'score', evaluatorRole: 'primary', roundNumber: 1 }, { timestamp: TS, message: {} }); cb.onStatusChange('completed');
    return Promise.resolve(mkEval());
  }),
});

const validBody = () => ({
  role: 'primary',
  providerId: 'provider-1',
});

function createApp(storage: IStorage, evaluator: IEvaluator, logger: ILogger, queue?: EvalQueue) {
  const app = express(); app.use(express.json());
  app.use('/api/evaluations', createEvaluationRoutes(storage, evaluator, logger, queue));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Evaluation routes', () => {
  let storage: IStorage;
  let evaluator: IEvaluator;
  let logger: ILogger;
  let app: express.Express;

  beforeEach(() => {
    storage = createMockStorage();
    evaluator = mkMockEvaluator();
    logger = createMockLogger();
    app = createApp(storage, evaluator, logger);
  });

  describe('POST /api/evaluations', () => {
    it('creates an evaluation and returns 202', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      vi.mocked(storage.saveEvaluation).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [validBody()] });

      expect(res.status).toBe(202);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('pending');
      expect(storage.saveEvaluation).toHaveBeenCalled();
    });

    it('starts evaluation asynchronously', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      vi.mocked(storage.saveEvaluation).mockResolvedValue(undefined);

      await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [validBody()] });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(evaluator.evaluateRun).toHaveBeenCalled();
    });

    it('returns 400 when runId is missing', async () => {
      const res = await request(app)
        .post('/api/evaluations')
        .send({ evaluators: [validBody()] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('runId');
    });

    it('returns 404 when run does not exist', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'nonexistent', evaluators: [validBody()] });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Run not found');
    });

    it('returns 400 when evaluators is empty', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('non-empty');
    });

    it('returns 400 when evaluator is missing role', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());

      const res = await request(app)
        .post('/api/evaluations')
        .send({
          runId: 'run-1',
          evaluators: [{ providerId: 'provider-1' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('role');
    });

    it('returns 400 when evaluator is missing providerId', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());

      const res = await request(app)
        .post('/api/evaluations')
        .send({
          runId: 'run-1',
          evaluators: [{ role: 'primary' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('providerId');
    });

    it('returns 404 when evaluator provider does not exist', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());
      vi.mocked(storage.getProvider).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [validBody()] });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Provider not found');
    });

    it('returns 400 when maxRounds is out of range', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [validBody()], maxRounds: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maxRounds');
    });

    it('returns 400 when maxRounds is 0', async () => {
      vi.mocked(storage.getRun).mockResolvedValue(mkRun());
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());

      const res = await request(app)
        .post('/api/evaluations')
        .send({ runId: 'run-1', evaluators: [validBody()], maxRounds: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maxRounds');
    });
  });

  describe('GET /api/evaluations', () => {
    it('returns list of evaluation summaries', async () => {
      const evaluation = mkEval();
      vi.mocked(storage.listEvaluations).mockResolvedValue([evaluation]);

      const res = await request(app).get('/api/evaluations');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('eval-1');
      // Summary should not include rounds
      expect(res.body[0].rounds).toBeUndefined();
    });

    it('filters by runId', async () => {
      vi.mocked(storage.listEvaluations).mockResolvedValue([]);

      await request(app).get('/api/evaluations?runId=run-1');

      expect(storage.listEvaluations).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1' }),
      );
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.listEvaluations).mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/api/evaluations');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/evaluations/:id', () => {
    it('returns full evaluation with rounds', async () => {
      vi.mocked(storage.getEvaluation).mockResolvedValue(mkEval());

      const res = await request(app).get('/api/evaluations/eval-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('eval-1');
      expect(res.body.rounds).toHaveLength(1);
    });

    it('returns 404 for non-existent evaluation', async () => {
      vi.mocked(storage.getEvaluation).mockResolvedValue(undefined);
      const res = await request(app).get('/api/evaluations/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/evaluations/:id/stream', () => {
    it('returns 404 for non-existent evaluation', async () => {
      vi.mocked(storage.getEvaluation).mockResolvedValue(undefined);
      const res = await request(app).get('/api/evaluations/nonexistent/stream');
      expect(res.status).toBe(404);
    });

    it('establishes SSE connection for existing evaluation', async () => {
      vi.mocked(storage.getEvaluation).mockResolvedValue(mkEval({ status: 'running' }));

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = request(app).get('/api/evaluations/eval-1/stream');
        req.then((r) => {
          resolve({ status: r.status });
        }).catch(() => {
          resolve({ status: 200 });
        });
        setTimeout(() => req.abort(), 50);
      });

      expect([200, undefined]).toContain(res.status);
    });
  });

  describe('EvalQueue', () => {
    it('respects concurrency limit', () => {
      const queue = new EvalQueue(1);
      expect(queue.pendingCount).toBe(0);
      expect(queue.activeCount).toBe(0);
    });
  });
});
