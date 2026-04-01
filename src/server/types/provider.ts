// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Scoring dimension used to evaluate a run. */
export interface ScoringDimension {
  readonly name: string;
  readonly weight: number;
  readonly description: string;
}

/** A provider configuration that defines how to connect to an LLM provider. */
export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly providerName: string;  // 'anthropic' | 'openai' | 'google' | etc.
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly timeoutSeconds: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
