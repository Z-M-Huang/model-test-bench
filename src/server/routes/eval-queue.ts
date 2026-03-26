// ---------------------------------------------------------------------------
// EvalQueue — concurrency-limited queue for evaluation execution
// ---------------------------------------------------------------------------

import type { Evaluation } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validated evaluator entry from the request body (providerId-based). */
export interface EvalEntry {
  readonly providerId: string;
  readonly role: string;
}

/** Validate an evaluator entry from request body. Returns parsed entry or error string. */
export function validateEvalEntry(raw: unknown): EvalEntry | string {
  if (!raw || typeof raw !== 'object') return 'Each evaluator must be an object';
  const obj = raw as Record<string, unknown>;
  if (!obj.role || typeof obj.role !== 'string') return 'Each evaluator must have a string role';
  if (!obj.providerId || typeof obj.providerId !== 'string') return 'Each evaluator must have a string providerId';
  return { providerId: obj.providerId as string, role: obj.role as string };
}

// ---------------------------------------------------------------------------
// Queue for evaluation execution
// ---------------------------------------------------------------------------

export interface EvalQueueEntry {
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
