import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ILogger } from '../interfaces/logger.js';
import type { RunCallbacks } from '../interfaces/runner.js';
import type { Run, SDKMessageRecord } from '../types/index.js';
import { makeProvider, makeScenario, makeRun } from './storage-test-helpers.js';

// Mock the AI SDK
const mockStreamText = vi.fn();
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', count: n })),
}));

// Mock model factory
vi.mock('./model-factory.js', () => ({
  createModel: vi.fn(() => ({ modelId: 'mock-model' })),
}));

// Mock tools
vi.mock('./tools.js', () => ({
  getEnabledTools: vi.fn(() => ({})),
}));

const { AiSdkRunner } = await import('./runner.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function mockCallbacks(): RunCallbacks & { messages: SDKMessageRecord[] } {
  const messages: SDKMessageRecord[] = [];
  return {
    messages,
    onMessage: vi.fn((msg: SDKMessageRecord) => messages.push(msg)),
    onStatusChange: vi.fn(),
  };
}

/** Build a mock streamText return value. fullStream is an async iterable of parts. */
function mockStreamResult(
  parts: Record<string, unknown>[] = [{ type: 'text-delta', text: 'Test result' }],
  overrides: { text?: string; steps?: unknown[]; usage?: Record<string, unknown> } = {},
) {
  async function* stream() {
    for (const part of parts) yield part;
  }
  return {
    fullStream: stream(),
    text: Promise.resolve(overrides.text ?? 'Test result'),
    usage: Promise.resolve(overrides.usage ?? { inputTokens: 10, outputTokens: 5 }),
    steps: Promise.resolve(overrides.steps ?? [{ text: 'Test result' }]),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiSdkRunner', () => {
  let runner: InstanceType<typeof AiSdkRunner>;
  let logger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = mockLogger();
    runner = new AiSdkRunner(logger);
    mockStreamText.mockReturnValue(mockStreamResult());
  });

  it('calls streamText with correct parameters', async () => {
    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    await runner.executeRun(provider, scenario, run, cb);

    expect(mockStreamText).toHaveBeenCalledOnce();
    const callArgs = mockStreamText.mock.calls[0][0];
    expect(callArgs.prompt).toBe(scenario.prompt);
    expect(callArgs.system).toBe(scenario.systemPrompt || undefined);
  });

  it('returns completed run with result text', async () => {
    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    const result = await runner.executeRun(provider, scenario, run, cb);

    expect(result.status).toBe('completed');
    expect(result.resultText).toBe('Test result');
    expect(result.numTurns).toBe(1);
  });

  it('reports status changes', async () => {
    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    await runner.executeRun(provider, scenario, run, cb);

    expect(cb.onStatusChange).toHaveBeenCalledWith('running');
    expect(cb.onStatusChange).toHaveBeenCalledWith('completed');
  });

  it('streams each part as a message callback', async () => {
    mockStreamText.mockReturnValue(mockStreamResult([
      { type: 'reasoning-delta', text: 'Thinking...' },
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' world' },
    ]));
    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    await runner.executeRun(provider, scenario, run, cb);

    expect(cb.onMessage).toHaveBeenCalledTimes(3);
    expect(cb.messages[0].message).toEqual(expect.objectContaining({ type: 'reasoning-delta', text: 'Thinking...' }));
    expect(cb.messages[1].message).toEqual(expect.objectContaining({ type: 'text-delta', text: 'Hello' }));
  });

  it('returns failed run on error', async () => {
    mockStreamText.mockImplementation(() => {
      async function* failStream(): AsyncGenerator<never> { throw new Error('API error'); }
      const textP = Promise.reject(new Error('API error'));
      textP.catch(() => {}); // prevent unhandled rejection — runner catches from fullStream
      return {
        fullStream: failStream(),
        text: textP,
        usage: Promise.resolve({}),
        steps: Promise.resolve([]),
      };
    });
    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    const result = await runner.executeRun(provider, scenario, run, cb);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('API error');
  });

  it('returns cancelled run on abort', async () => {
    const abortController = new AbortController();
    mockStreamText.mockImplementation(() => {
      abortController.abort();
      async function* abortStream(): AsyncGenerator<never> { throw new Error('aborted'); }
      const textP = Promise.reject(new Error('aborted'));
      textP.catch(() => {}); // prevent unhandled rejection — runner catches from fullStream
      return {
        fullStream: abortStream(),
        text: textP,
        usage: Promise.resolve({}),
        steps: Promise.resolve([]),
      };
    });

    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    const result = await runner.executeRun(provider, scenario, run, cb, abortController);

    expect(result.status).toBe('cancelled');
  });

  it('handles empty stream', async () => {
    mockStreamText.mockReturnValue(mockStreamResult([], {
      text: 'Direct response',
      steps: [],
      usage: { inputTokens: 5, outputTokens: 3 },
    }));

    const provider = makeProvider();
    const scenario = makeScenario();
    const run = makeRun(provider.id, scenario.id);
    const cb = mockCallbacks();

    const result = await runner.executeRun(provider, scenario, run, cb);

    expect(result.status).toBe('completed');
    expect(result.resultText).toBe('Direct response');
    expect(result.numTurns).toBe(0);
  });
});
