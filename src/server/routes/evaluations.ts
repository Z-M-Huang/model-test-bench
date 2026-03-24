// ---------------------------------------------------------------------------
// Evaluation routes — start, list, get, stream evaluations
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { IEvaluator, EvaluationCallbacks } from '../interfaces/evaluator.js';
import type { Evaluation, EvaluationRequest, EvaluatorConfig, EvaluationStatus } from '../types/index.js';
import { handleSSEConnection, broadcastSSE, closeSSE } from './run-sse.js';
import type { SSESubscriberMap } from './run-sse.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Validate an evaluator config from request body. */
function validateEvaluatorConfig(raw: unknown): EvaluatorConfig | string {
  if (!raw || typeof raw !== 'object') return 'Each evaluator must be an object';
  const obj = raw as Record<string, unknown>;
  if (!obj.role || typeof obj.role !== 'string') return 'Each evaluator must have a string role';
  if (!obj.provider || typeof obj.provider !== 'object') return 'Each evaluator must have a provider';

  const provider = obj.provider as Record<string, unknown>;
  if (!provider.model || typeof provider.model !== 'string') {
    return 'Each evaluator provider must have a string model';
  }

  const kind = provider.kind as string | undefined;
  if (kind === 'api') {
    if (!provider.apiKey || typeof provider.apiKey !== 'string') {
      return 'API provider requires apiKey';
    }
    if (!provider.baseUrl || typeof provider.baseUrl !== 'string') {
      return 'API provider requires baseUrl';
    }
    return {
      role: obj.role as string,
      provider: {
        kind: 'api',
        apiKey: provider.apiKey as string,
        baseUrl: provider.baseUrl as string,
        model: provider.model as string,
      },
    };
  }

  if (kind === 'oauth') {
    if (!provider.oauthToken || typeof provider.oauthToken !== 'string') {
      return 'OAuth provider requires oauthToken';
    }
    return {
      role: obj.role as string,
      provider: {
        kind: 'oauth',
        oauthToken: provider.oauthToken as string,
        model: provider.model as string,
      },
    };
  }

  return 'Provider kind must be "api" or "oauth"';
}

/** Strip rounds from evaluation for list endpoint summaries. */
function evalSummary(
  evaluation: Evaluation,
): Omit<Evaluation, 'rounds'> & { rounds?: undefined } {
  const { rounds: _rounds, ...rest } = evaluation;
  return rest;
}

// ---------------------------------------------------------------------------
// Queue for evaluation execution
// ---------------------------------------------------------------------------

interface EvalQueueEntry {
  evaluation: Evaluation;
  execute: () => Promise<void>;
}

export class EvalQueue {
  private readonly queue: EvalQueueEntry[] = [];
  private active = 0;
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  enqueue(entry: EvalQueueEntry): void {
    this.queue.push(entry);
    void this.drain();
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }

  private async drain(): Promise<void> {
    while (this.active < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      this.active++;
      next.execute().finally(() => {
        this.active--;
        void this.drain();
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createEvaluationRoutes(
  storage: IStorage,
  evaluator: IEvaluator,
  logger: ILogger,
  queue?: EvalQueue,
): Router {
  const router = Router();
  const evalQueue = queue ?? new EvalQueue(1);
  const sseSubscribers: SSESubscriberMap = new Map();

  // POST / — start a new evaluation
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const runId = body.runId as string | undefined;

      if (!runId) {
        res.status(400).json({ error: 'runId is required' });
        return;
      }

      const run = await storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      // Validate evaluators
      const rawEvaluators = body.evaluators;
      if (!Array.isArray(rawEvaluators) || rawEvaluators.length === 0) {
        res.status(400).json({ error: 'evaluators must be a non-empty array' });
        return;
      }

      const evaluators: EvaluatorConfig[] = [];
      for (const raw of rawEvaluators) {
        const result = validateEvaluatorConfig(raw);
        if (typeof result === 'string') {
          res.status(400).json({ error: result });
          return;
        }
        evaluators.push(result);
      }

      // Validate maxRounds
      const maxRounds = typeof body.maxRounds === 'number' ? body.maxRounds : 1;
      if (maxRounds < 1 || maxRounds > 5) {
        res.status(400).json({ error: 'maxRounds must be between 1 and 5' });
        return;
      }

      const maxBudgetUsd = typeof body.maxBudgetUsd === 'number' ? body.maxBudgetUsd : undefined;

      const evalRequest: EvaluationRequest = { runId, evaluators, maxRounds, maxBudgetUsd };

      const now = new Date().toISOString();
      const evaluation: Evaluation = {
        id: uuidv4(),
        runId,
        status: 'pending',
        evaluators,
        rounds: [],
        answerComparison: { matches: false, explanation: '', similarity: 0 },
        criticalResults: [],
        setupCompliance: {
          instructionCompliance: { followed: [], violated: [], notApplicable: [], overallCompliance: 0 },
          skillUsage: [],
          subagentUsage: [],
        },
        synthesis: { dimensionScores: {}, weightedTotal: 0, confidence: 0, dissenting: [] },
        ledger: [],
        totalCostUsd: 0,
        createdAt: now,
        updatedAt: now,
      };

      await storage.saveEvaluation(evaluation);

      // Load related data for the evaluator
      const setup = run.setupSnapshot;
      const scenario = run.scenarioSnapshot;

      evalQueue.enqueue({
        evaluation,
        execute: async () => {
          const callbacks: EvaluationCallbacks = {
            onStatusChange(status: EvaluationStatus) {
              const updatedEval: Evaluation = {
                ...evaluation,
                status,
                updatedAt: new Date().toISOString(),
              };
              broadcastSSE(evaluation.id, 'status', status, sseSubscribers);
              storage.saveEvaluation(updatedEval).catch((saveErr) => {
                logger.error('Failed to persist evaluation status change', {
                  evalId: evaluation.id,
                  status,
                  error: String(saveErr),
                });
              });
            },
          };

          try {
            const result = await evaluator.evaluateRun(run, scenario, setup, evalRequest, callbacks);
            const finalEval: Evaluation = {
              ...result,
              id: evaluation.id,
              updatedAt: new Date().toISOString(),
            };
            await storage.saveEvaluation(finalEval);
          } catch (err) {
            logger.error('Evaluation failed', { evalId: evaluation.id, error: String(err) });
            broadcastSSE(evaluation.id, 'status', 'failed', sseSubscribers);
            const failedEval: Evaluation = {
              ...evaluation,
              status: 'failed',
              updatedAt: new Date().toISOString(),
            };
            await storage.saveEvaluation(failedEval).catch((saveErr) => {
              logger.error('Failed to save failed evaluation', {
                evalId: evaluation.id,
                error: String(saveErr),
              });
            });
          } finally {
            closeSSE(evaluation.id, sseSubscribers);
          }
        },
      });

      res.status(202).json({ id: evaluation.id, status: 'pending' });
    } catch (err) {
      logger.error('Failed to start evaluation', { error: String(err) });
      res.status(500).json({ error: 'Failed to start evaluation' });
    }
  });

  // GET / — list evaluations
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filter: Record<string, string | undefined> = {};
      if (typeof req.query.runId === 'string') filter.runId = req.query.runId;

      const evaluations = await storage.listEvaluations(filter);
      res.json(evaluations.map(evalSummary));
    } catch (err) {
      logger.error('Failed to list evaluations', { error: String(err) });
      res.status(500).json({ error: 'Failed to list evaluations' });
    }
  });

  // GET /:id — get full evaluation
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const evaluation = await storage.getEvaluation(id);
      if (!evaluation) {
        res.status(404).json({ error: 'Evaluation not found' });
        return;
      }
      res.json(evaluation);
    } catch (err) {
      logger.error('Failed to get evaluation', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get evaluation' });
    }
  });

  // GET /:id/stream — SSE endpoint
  router.get('/:id/stream', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const evaluation = await storage.getEvaluation(id);
      if (!evaluation) {
        res.status(404).json({ error: 'Evaluation not found' });
        return;
      }
      handleSSEConnection(req, res, id, sseSubscribers);
    } catch (err) {
      logger.error('Failed to start eval SSE stream', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to start stream' });
    }
  });

  return router;
}
