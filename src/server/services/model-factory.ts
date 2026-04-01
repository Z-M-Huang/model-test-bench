// ---------------------------------------------------------------------------
// Model Factory — creates AI SDK model instances from provider config
// ---------------------------------------------------------------------------

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  readonly providerName: string;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
}

const SUPPORTED_PROVIDERS = ['anthropic', 'openai', 'google'] as const;

export function createModel(config: ModelConfig): LanguageModel {
  switch (config.providerName) {
    case 'anthropic':
      return createAnthropic({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model);

    case 'openai':
      return createOpenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model);

    case 'google':
      return createGoogleGenerativeAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model);

    default:
      throw new Error(
        `Unsupported provider: "${config.providerName}". ` +
        `Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
      );
  }
}

export function isSupportedProvider(name: string): boolean {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(name);
}
