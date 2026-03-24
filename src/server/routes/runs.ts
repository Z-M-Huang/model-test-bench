// ---------------------------------------------------------------------------
// Run routes — start, list, get, delete, stream runs
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { IRunner, RunCallbacks } from '../interfaces/runner.js';
import type { Run, RunStatus } from '../types/index.js';
import { handleSSEConnection, broadcastSSE, closeSSE } from './run-sse.js';
import type { SSESubscriberMap } from './run-sse.js';

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
  queue?: RunQueue,
): Router {
  const router = Router();
  const runQueue = queue ?? new RunQueue(1);
  const sseSubscribers: SSESubscriberMap = new Map();

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
            closeSSE(run.id, sseSubscribers);
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
