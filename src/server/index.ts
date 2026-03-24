import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IStorage } from './interfaces/storage.js';
import type { ILogger } from './interfaces/logger.js';
import type { IRunner } from './interfaces/runner.js';
import { createSetupRoutes } from './routes/setups.js';
import { createScenarioRoutes } from './routes/scenarios.js';
import { createRunRoutes } from './routes/runs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppDeps {
  storage: IStorage;
  logger: ILogger;
  runner?: IRunner;
}

export function createApp(deps: AppDeps): express.Express {
  const { logger } = deps;
  const app = express();

  // ─── CORS for dev mode ─────────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ─── JSON body parser ──────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));

  // ─── Health check ──────────────────────────────────────────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── API routes ──────────────────────────────────────────────────────
  app.use('/api/setups', createSetupRoutes(deps.storage, deps.logger));
  app.use('/api/scenarios', createScenarioRoutes(deps.storage, deps.logger));
  if (deps.runner) {
    app.use('/api/runs', createRunRoutes(deps.storage, deps.runner, deps.logger));
  }

  // ─── Static files (production) ─────────────────────────────────────
  const webDistPath = path.resolve(__dirname, '..', 'web');
  app.use(express.static(webDistPath));

  // SPA fallback: serve index.html for non-API routes
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
      if (err) {
        next();
      }
    });
  });

  // ─── Error handling middleware ──────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
