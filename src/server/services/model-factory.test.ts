import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createModel, isSupportedProvider } from './model-factory.js';
import type { ModelConfig } from './model-factory.js';

// Mock all provider packages
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ modelId: 'anthropic-mock' }))),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'openai-mock' }))),
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({ modelId: 'google-mock' }))),
}));

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

describe('model-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const MOCK_KEY = 'mock-value-for-testing';

  const base: ModelConfig = {
    providerName: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: MOCK_KEY,
  };

  describe('createModel', () => {
    it('creates Anthropic model', () => {
      const model = createModel({ ...base, providerName: 'anthropic' });
      expect(createAnthropic).toHaveBeenCalledWith({ apiKey: MOCK_KEY });
      expect(model).toBeDefined();
    });

    it('creates OpenAI model', () => {
      const model = createModel({ ...base, providerName: 'openai', model: 'gpt-4o' });
      expect(createOpenAI).toHaveBeenCalledWith({ apiKey: MOCK_KEY });
      expect(model).toBeDefined();
    });

    it('creates Google model', () => {
      const model = createModel({ ...base, providerName: 'google', model: 'gemini-2.0-flash' });
      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: MOCK_KEY });
      expect(model).toBeDefined();
    });

    it('passes baseUrl when provided', () => {
      createModel({ ...base, baseUrl: 'https://custom.api.com' });
      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: MOCK_KEY,
        baseURL: 'https://custom.api.com',
      });
    });

    it('throws for unsupported provider', () => {
      expect(() => createModel({ ...base, providerName: 'unknown' }))
        .toThrow('Unsupported provider: "unknown"');
    });

    it('includes supported providers in error message', () => {
      expect(() => createModel({ ...base, providerName: 'bad' }))
        .toThrow('anthropic, openai, google');
    });
  });

  describe('isSupportedProvider', () => {
    it('returns true for supported providers', () => {
      expect(isSupportedProvider('anthropic')).toBe(true);
      expect(isSupportedProvider('openai')).toBe(true);
      expect(isSupportedProvider('google')).toBe(true);
    });

    it('returns false for unsupported providers', () => {
      expect(isSupportedProvider('unknown')).toBe(false);
      expect(isSupportedProvider('')).toBe(false);
    });
  });
});
