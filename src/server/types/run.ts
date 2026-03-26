// ---------------------------------------------------------------------------
// Run Types
// ---------------------------------------------------------------------------

import type { Provider } from './provider.js';
import type { Scenario } from './scenario.js';

/** A raw SDK message captured during a run. */
export interface SDKMessageRecord {
  readonly timestamp: string;
  readonly message: Readonly<Record<string, unknown>>;
}

/** Lifecycle status of a run. */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** A single run: one provider + one scenario + captured output. */
export interface Run {
  readonly id: string;
  readonly providerId: string;
  readonly scenarioId: string;
  readonly status: RunStatus;
  readonly providerSnapshot: Provider;
  readonly scenarioSnapshot: Scenario;
  readonly messages: readonly SDKMessageRecord[];
  readonly resultText: string;
  readonly totalCostUsd: number;
  readonly durationMs: number;
  readonly numTurns: number;
  readonly error?: string;
  // Auto-evaluation config: reviewer providers selected at run creation time
  readonly reviewerProviderIds?: readonly string[];
  readonly reviewerProviderSnapshots?: readonly Provider[];
  readonly maxEvalRounds?: number;
  readonly evaluationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
