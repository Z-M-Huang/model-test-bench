// ---------------------------------------------------------------------------
// Run routes — start, list, get, delete, stream runs
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { IRunner, RunCallbacks } from '../interfaces/runner.js';
import type { IEvaluator, EvaluationCallbacks } from '../interfaces/evaluator.js';
import type { Run, RunStatus, TestSetup, Evaluation, EvaluationRequest, EvaluatorConfig, EvaluationStatus } from '../types/index.js';
import { handleSSEConnection, broadcastSSE, closeSSE } from './run-sse.js';
import type { SSESubscriberMap } from './run-sse.js';
import { EvalQueue } from './eval-queue.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Strip messages from a run for the summary endpoint. */
function runSummary(run: Run): Omit<Run, 'messages'> & { messages?: undefined } {
  const { messages: _messages, ...rest } = run;
  return rest;
}

/** Build EvaluatorConfig[] from reviewer setup snapshots. N-1 as Evaluators, last as Synthesizer. */
function buildEvaluatorConfigs(reviewerSnapshots: readonly TestSetup[]): EvaluatorConfig[] {
  return reviewerSnapshots.map((setup, idx) => ({
    provider: setup.provider,
    role: idx < reviewerSnapshots.length - 1
      ? (reviewerSnapshots.length > 2 ? `Evaluator ${idx + 1}` : 'Evaluator')
      : 'Synthesizer',
  }));
}

// Import and re-export RunQueue from extracted module
import { RunQueue } from './run-queue.js';
export { RunQueue } from './run-queue.js';

// ---------------------------------------------------------------------------
// Abort controller registry (for cancelling running runs)
// ---------------------------------------------------------------------------

const abortControllers = new Map<string, AbortController>();

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createRunRoutes(
  storage: IStorage,
  runner: IRunner,
  logger: ILogger,
  evaluator?: IEvaluator,
  queue?: RunQueue,
): Router {
  const router = Router();
  const runQueue = queue ?? new RunQueue(1);
  const sseSubscribers: SSESubscriberMap = new Map();

  const evalQueue = new EvalQueue(1);

  // POST / — start a new run
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const setupId = body.setupId as string | undefined;
      const scenarioId = body.scenarioId as string | undefined;

      if (!setupId || !scenarioId) {
        res.status(400).json({ error: 'setupId and scenarioId are required' });
        return;
      }

      const setup = await storage.getSetup(setupId);
      if (!setup) {
        res.status(404).json({ error: 'Setup not found' });
        return;
      }

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        res.status(404).json({ error: 'Scenario not found' });
        return;
      }

      // Optional reviewer setups for auto-evaluation
      const rawReviewerIds = body.reviewerSetupIds;
      let reviewerSetupIds: string[] | undefined;
      let reviewerSetupSnapshots: TestSetup[] | undefined;
      if (Array.isArray(rawReviewerIds) && rawReviewerIds.length > 0) {
        reviewerSetupIds = [];
        reviewerSetupSnapshots = [];
        for (const rid of rawReviewerIds) {
          if (typeof rid !== 'string') {
            res.status(400).json({ error: 'reviewerSetupIds must be an array of strings' });
            return;
          }
          const reviewerSetup = await storage.getSetup(rid);
          if (!reviewerSetup) {
            res.status(404).json({ error: `Reviewer setup not found: ${rid}` });
            return;
          }
          reviewerSetupIds.push(rid);
          reviewerSetupSnapshots.push(reviewerSetup);
        }
      }

      const maxEvalRounds = typeof body.maxEvalRounds === 'number'
        ? Math.min(5, Math.max(1, body.maxEvalRounds))
        : undefined;

      const now = new Date().toISOString();
      const run: Run = {
        id: uuidv4(),
        setupId,
        scenarioId,
        status: 'pending',
        setupSnapshot: setup,
        scenarioSnapshot: scenario,
        messages: [],
        resultText: '',
        totalCostUsd: 0,
        durationMs: 0,
        numTurns: 0,
        reviewerSetupIds,
        reviewerSetupSnapshots,
        maxEvalRounds,
        createdAt: now,
        updatedAt: now,
      };

      await storage.saveRun(run);

      // Enqueue async execution
      const abortController = new AbortController();
      abortControllers.set(run.id, abortController);

      runQueue.enqueue({
        run,
        execute: async () => {
          const callbacks: RunCallbacks = {
            onMessage(message) {
              broadcastSSE(run.id, 'message', message, sseSubscribers);
            },
            onStatusChange(status: RunStatus) {
              const updatedRun: Run = {
                ...run,
                status,
                updatedAt: new Date().toISOString(),
              };
              broadcastSSE(run.id, 'status', status, sseSubscribers);
              storage.saveRun(updatedRun).catch((saveErr) => {
                logger.error('Failed to persist status change', {
                  runId: run.id,
                  status,
                  error: String(saveErr),
                });
              });
            },
          };

          try {
            const result = await runner.executeRun(setup, scenario, run, callbacks, abortController);
            await storage.saveRun(result);

            // Auto-trigger evaluation if reviewer setups were configured
            if (result.status === 'completed' && evaluator && reviewerSetupSnapshots && reviewerSetupSnapshots.length > 0) {
              try {
                const evaluatorConfigs = buildEvaluatorConfigs(reviewerSetupSnapshots);
                const evalRequest: EvaluationRequest = {
                  runId: result.id,
                  evaluators: evaluatorConfigs,
                  maxRounds: maxEvalRounds ?? 1,
                };

                const evalNow = new Date().toISOString();
                const evaluation: Evaluation = {
                  id: uuidv4(),
                  runId: result.id,
                  status: 'pending',
                  evaluators: evaluatorConfigs,
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
                  createdAt: evalNow,
                  updatedAt: evalNow,
                };

                await storage.saveEvaluation(evaluation);

                // Link evaluation to the run
                const linkedRun: Run = {
                  ...result,
                  evaluationId: evaluation.id,
                  updatedAt: new Date().toISOString(),
                };
                await storage.saveRun(linkedRun);

                // Broadcast the evaluation ID to SSE subscribers
                broadcastSSE(run.id, 'evaluation', { evaluationId: evaluation.id }, sseSubscribers);

                // Enqueue evaluation execution
                evalQueue.enqueue({
                  evaluation,
                  execute: async () => {
                    const evalCallbacks: EvaluationCallbacks = {
                      onStatusChange(evalStatus: EvaluationStatus) {
                        broadcastSSE(run.id, 'evalStatus', evalStatus, sseSubscribers);
                        const updatedEval: Evaluation = {
                          ...evaluation,
                          status: evalStatus,
                          updatedAt: new Date().toISOString(),
                        };
                        storage.saveEvaluation(updatedEval).catch((saveErr) => {
                          logger.error('Failed to persist eval status', {
                            evalId: evaluation.id,
                            error: String(saveErr),
                          });
                        });
                      },
                    };

                    try {
                      const evalResult = await evaluator.evaluateRun(
                        linkedRun, scenario, setup, evalRequest, evalCallbacks,
                      );
                      const finalEval: Evaluation = {
                        ...evalResult,
                        id: evaluation.id,
                        updatedAt: new Date().toISOString(),
                      };
                      await storage.saveEvaluation(finalEval);
                      broadcastSSE(run.id, 'evalComplete', { evaluationId: evaluation.id }, sseSubscribers);
                    } catch (evalErr) {
                      logger.error('Auto-evaluation failed', {
                        runId: run.id,
                        evalId: evaluation.id,
                        error: String(evalErr),
                      });
                      const failedEval: Evaluation = {
                        ...evaluation,
                        status: 'failed',
                        updatedAt: new Date().toISOString(),
                      };
                      await storage.saveEvaluation(failedEval).catch(() => {});
                    }
                  },
                });
              } catch (evalSetupErr) {
                logger.error('Failed to set up auto-evaluation', {
                  runId: run.id,
                  error: String(evalSetupErr),
                });
                // Run itself succeeded — don't fail it because eval setup failed
              }
            }
          } catch (err) {
            logger.error('Run execution failed', {
              runId: run.id,
              error: String(err),
            });
            const failedRun: Run = {
              ...run,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
              updatedAt: new Date().toISOString(),
            };
            await storage.saveRun(failedRun).catch((saveErr) => {
              logger.error('Failed to save failed run', {
                runId: run.id,
                error: String(saveErr),
              });
            });
          } finally {
            abortControllers.delete(run.id);
            // Don't close SSE yet if evaluation is running — it will close when eval completes
            if (!reviewerSetupSnapshots || reviewerSetupSnapshots.length === 0) {
              closeSSE(run.id, sseSubscribers);
            }
          }
        },
      });

      res.status(202).json({ id: run.id, status: 'pending' });
    } catch (err) {
      logger.error('Failed to start run', { error: String(err) });
      res.status(500).json({ error: 'Failed to start run' });
    }
  });

  // GET / — list runs
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filter: Record<string, string | undefined> = {};
      if (typeof req.query.setupId === 'string') filter.setupId = req.query.setupId;
      if (typeof req.query.scenarioId === 'string') filter.scenarioId = req.query.scenarioId;

      const runs = await storage.listRuns(filter);
      res.json(runs.map(runSummary));
    } catch (err) {
      logger.error('Failed to list runs', { error: String(err) });
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  // GET /:id — get full run
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const run = await storage.getRun(id);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.json(run);
    } catch (err) {
      logger.error('Failed to get run', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get run' });
    }
  });

  // GET /:id/summary — get run without messages
  router.get('/:id/summary', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const run = await storage.getRun(id);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.json(runSummary(run));
    } catch (err) {
      logger.error('Failed to get run summary', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get run summary' });
    }
  });

  // DELETE /:id — delete run (or abort if running)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const run = await storage.getRun(id);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      // Abort if running
      const controller = abortControllers.get(id);
      if (controller) {
        controller.abort();
        abortControllers.delete(id);
      }

      const deleted = await storage.deleteRun(id);
      if (!deleted) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error('Failed to delete run', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to delete run' });
    }
  });

  // GET /:id/stream — SSE endpoint
  router.get('/:id/stream', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const run = await storage.getRun(id);
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      // If run is already terminal, send final status and close immediately
      const terminalStatuses: RunStatus[] = ['completed', 'failed', 'cancelled'];
      if (terminalStatuses.includes(run.status)) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.flushHeaders();
        res.write(`event: status\ndata: ${JSON.stringify(run.status)}\n\n`);
        res.write('event: done\ndata: {}\n\n');
        res.end();
        return;
      }

      handleSSEConnection(req, res, id, sseSubscribers);
    } catch (err) {
      logger.error('Failed to start SSE stream', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to start stream' });
    }
  });

  return router;
}
