// ---------------------------------------------------------------------------
// RunQueue — in-memory concurrency limiter for scenario runs
// ---------------------------------------------------------------------------

export interface QueueEntry {
  run: { readonly id: string };
  execute: () => Promise<void>;
}

export class RunQueue {
  private readonly queue: QueueEntry[] = [];
  private active = 0;
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  enqueue(entry: QueueEntry): void {
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
