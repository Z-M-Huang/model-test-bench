#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { LogLevel } from '../src/server/interfaces/logger.js';
import { JsonLogger } from '../src/server/services/logger.js';
import { JsonFileStorage } from '../src/server/services/storage.js';
import { createApp } from '../src/server/index.js';

// ─── .env loader (same approach as POC) ──────────────────────────────

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && val && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// ─── Arg parsing ─────────────────────────────────────────────────────

interface CliArgs {
  port: number;
  logLevel: LogLevel;
  open: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    port: 3847,
    logLevel: 'info',
    open: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && i + 1 < argv.length) {
      const parsed = parseInt(argv[++i], 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) {
        args.port = parsed;
      }
    } else if (arg === '--log-level' && i + 1 < argv.length) {
      const level = argv[++i] as LogLevel;
      if (['debug', 'info', 'warn', 'error'].includes(level)) {
        args.logLevel = level;
      }
    } else if (arg === '--no-open') {
      args.open = false;
    } else if (arg === '--open') {
      args.open = true;
    }
  }

  return args;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Load .env from the user's current working directory
  loadEnvFile(path.join(process.cwd(), '.env'));

  const cliArgs = parseArgs(process.argv);

  const logger = new JsonLogger(cliArgs.logLevel);

  // Resolve the built-in scenarios directory relative to this file's location.
  // In the compiled output (dist/bin/ctb.js), __dirname → <root>/dist/bin,
  // so ../../scenarios points to <root>/scenarios.
  const projectRoot = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
  );
  const builtInScenariosDir = path.join(projectRoot, 'scenarios');
  const storage = new JsonFileStorage(undefined, undefined, builtInScenariosDir);

  const app = createApp({ storage, logger });
  const server = http.createServer(app);

  const url = `http://localhost:${cliArgs.port}`;

  server.listen(cliArgs.port, () => {
    logger.info('Server started', { port: cliArgs.port, url });

    if (cliArgs.open) {
      // Dynamic import to handle ESM 'open' package
      import('open')
        .then((mod) => mod.default(url))
        .catch((err: Error) => {
          logger.warn('Failed to open browser', { error: err.message });
        });
    }
  });

  // ─── Graceful shutdown ───────────────────────────────────────────
  const shutdown = (): void => {
    logger.info('Shutting down...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    // Force exit after 5 seconds
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: Error) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
