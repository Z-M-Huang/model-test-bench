import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SDKMessage, Query } from '@anthropic-ai/claude-agent-sdk';
import type { IWorkspaceBuilder, WorkspaceResult } from '../interfaces/workspace.js';
import type { ILogger } from '../interfaces/logger.js';
import type { RunCallbacks } from '../interfaces/runner.js';
import type { Run, SDKMessageRecord } from '../types/index.js';
import { makeProvider, makeScenario, makeRun } from './storage-test-helpers.js';

// Mock the SDK — must be before importing the runner
const mockQueryFn = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQueryFn(...args),
}));
const { ScenarioRunner } = await import('./runner.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID = '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`;
const USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null };

function successResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'result', subtype: 'success', result: '', total_cost_usd: 0,
    num_turns: 0, duration_ms: 0, duration_api_ms: 0, is_error: false,
    stop_reason: null, usage: USAGE, modelUsage: {}, permission_denials: [],
    uuid: UUID, session_id: 's1', ...overrides,
  };
}

function errorResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'result', subtype: 'error_during_execution', total_cost_usd: 0.01,
    num_turns: 1, duration_ms: 500, duration_api_ms: 400, is_error: true,
    stop_reason: null, usage: USAGE, modelUsage: {}, permission_denials: [],
    errors: ['Something went wrong'], uuid: UUID, session_id: 's1', ...overrides,
  };
}

function createMockQuery(messages: Record<string, unknown>[]): Query {
  async function* gen() { for (const msg of messages) yield msg; }
  return gen() as unknown as Query;
}

function createMockWorkspace(): IWorkspaceBuilder & { cleanup: ReturnType<typeof vi.fn> } {
  const cleanupFn = vi.fn().mockResolvedValue(undefined);
  return {
    cleanup: cleanupFn,
    createWorkspace: vi.fn().mockResolvedValue({
      workspacePath: '/tmp/ctb-run-test', cleanup: cleanupFn,
    } satisfies WorkspaceResult),
  };
}

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

function createMockCallbacks(): RunCallbacks & { messages: SDKMessageRecord[]; statuses: string[] } {
  const messages: SDKMessageRecord[] = [];
  const statuses: string[] = [];
  return {
    messages, statuses,
    onMessage: vi.fn((msg: SDKMessageRecord) => messages.push(msg)),
    onStatusChange: vi.fn((status: string) => statuses.push(status)),
  };
}

function makeTestRun(overrides: Partial<Run> = {}): Run {
  return makeRun({ status: 'pending', ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioRunner', () => {
  let workspace: ReturnType<typeof createMockWorkspace>;
  let logger: ILogger;
  let runner: InstanceType<typeof ScenarioRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    workspace = createMockWorkspace();
    logger = createMockLogger();
    runner = new ScenarioRunner(workspace, logger);
  });

  describe('successful run', () => {
    it('collects messages and returns completed run', async () => {
      const msgs = [
        { type: 'assistant', message: {}, uuid: UUID, session_id: 's1', parent_tool_use_id: null },
        successResult({ result: 'Task completed', total_cost_usd: 0.05, num_turns: 3 }),
      ];
      mockQueryFn.mockReturnValue(createMockQuery(msgs));
      const callbacks = createMockCallbacks();

      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), callbacks);

      expect(result.status).toBe('completed');
      expect(result.resultText).toBe('Task completed');
      expect(result.totalCostUsd).toBe(0.05);
      expect(result.numTurns).toBe(3);
      expect(result.messages).toHaveLength(2);
      expect(callbacks.statuses).toContain('running');
      expect(callbacks.statuses).toContain('completed');
    });
  });

  describe('env construction', () => {
    it('passes API provider env vars to the SDK', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      const callArgs = mockQueryFn.mock.calls[0][0] as { options: { env: Record<string, string> } };
      expect(callArgs.options.env['ANTHROPIC_API_KEY']).toBe('sk-test');
      expect(callArgs.options.env['ANTHROPIC_BASE_URL']).toBe('https://api.anthropic.com');
      expect(callArgs.options.env['ANTHROPIC_DEFAULT_MODEL']).toBe('claude-sonnet-4-6');
    });

    it('passes OAuth provider env vars to the SDK', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const provider = makeProvider({
        provider: { kind: 'oauth', oauthToken: 'test-token', model: 'claude-sonnet-4-6' },
      });
      await runner.executeRun(provider, makeScenario(), makeTestRun(), createMockCallbacks());

      const callArgs = mockQueryFn.mock.calls[0][0] as { options: { env: Record<string, string> } };
      expect(callArgs.options.env['CLAUDE_CODE_OAUTH_TOKEN']).toBe('test-token');
      expect(callArgs.options.env['ANTHROPIC_API_KEY']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns failed run on SDK error result', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([errorResult()]));
      const callbacks = createMockCallbacks();

      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), callbacks);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Something went wrong');
      expect(result.totalCostUsd).toBe(0.01);
      expect(callbacks.statuses).toContain('failed');
    });

    it('returns failed run on thrown error', async () => {
      mockQueryFn.mockReturnValue((function* () { throw new Error('Network failure'); })());
      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network failure');
    });

    it('handles non-Error thrown values', async () => {
      mockQueryFn.mockReturnValue((function* () { throw 'string error'; })());
      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      expect(result.status).toBe('failed');
      expect(result.error).toBe('string error');
    });

    it('returns failed when workspace creation throws', async () => {
      (workspace.createWorkspace as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk full'));
      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      expect(result.status).toBe('failed');
      expect(result.error).toBe('disk full');
    });
  });

  describe('timeout/abort', () => {
    it('returns cancelled run when aborted', async () => {
      mockQueryFn.mockImplementation(({ options }: { options: { abortController: AbortController } }) => {
        options.abortController.abort();
        return (async function* () { throw new Error('aborted'); })();
      });

      const result = await runner.executeRun(
        makeProvider({ timeoutSeconds: 1 }), makeScenario(), makeTestRun(), createMockCallbacks(),
      );

      expect(result.status).toBe('cancelled');
      expect(result.error).toContain('Timeout');
    });
  });

  describe('cleanup', () => {
    it('cleans up workspace on success', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult({ result: 'done', num_turns: 1 })]));
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());
      expect(workspace.cleanup).toHaveBeenCalledTimes(1);
    });

    it('cleans up workspace on failure', async () => {
      mockQueryFn.mockReturnValue((function* () { throw new Error('boom'); })());
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());
      expect(workspace.cleanup).toHaveBeenCalledTimes(1);
    });

    it('logs warning if cleanup fails', async () => {
      workspace.cleanup.mockRejectedValue(new Error('rm failed'));
      mockQueryFn.mockReturnValue(createMockQuery([successResult({ result: 'done' })]));
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to clean up workspace',
        expect.objectContaining({ runId: 'run-1' }),
      );
    });
  });

  describe('message collection', () => {
    it('captures all messages with timestamps', async () => {
      const msgs = [
        { type: 'system', subtype: 'compact_boundary' },
        { type: 'assistant', message: {}, uuid: UUID, session_id: 's1', parent_tool_use_id: null },
        successResult({ result: 'ok', num_turns: 1 }),
      ];
      mockQueryFn.mockReturnValue(createMockQuery(msgs));
      const callbacks = createMockCallbacks();

      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), callbacks);

      expect(result.messages).toHaveLength(3);
      for (const msg of result.messages) {
        expect(new Date(msg.timestamp).toISOString()).toBe(msg.timestamp);
      }
      expect(callbacks.onMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('SDK options', () => {
    it('passes correct options to the SDK query', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const provider = makeProvider({
        thinking: { kind: 'adaptive' }, effort: 'high',
      });
      const scenario = makeScenario({
        maxTurns: 5, permissionMode: 'bypassPermissions',
        allowedTools: ['Read', 'Bash'],
      });

      await runner.executeRun(provider, scenario, makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { prompt: string; options: Record<string, unknown> }).options;
      expect(opts.maxTurns).toBe(5);
      expect(opts.permissionMode).toBe('bypassPermissions');
      expect(opts.allowDangerouslySkipPermissions).toBe(true);
      expect(opts.thinking).toEqual({ type: 'adaptive' });
      expect(opts.effort).toBe('high');
      expect(opts.allowedTools).toEqual(['Read', 'Bash']);
      expect(opts.persistSession).toBe(false);
      expect(opts.settingSources).toEqual(['project']);
      expect(opts.sandbox).toEqual({ enabled: true, autoAllowBashIfSandboxed: true });
    });

    it('includes agents option when subagents are defined', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const scenario = makeScenario({
        subagents: [{ name: 'helper', description: 'Helps', prompt: 'You help.' }],
      });
      await runner.executeRun(makeProvider(), scenario, makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.agents).toBeDefined();
      expect((opts.agents as Record<string, unknown>)['helper']).toBeDefined();
    });

    it('includes mcpServers option when MCP servers are defined', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const scenario = makeScenario({
        mcpServers: [{ name: 'my-mcp', config: { transport: 'stdio', command: 'cmd' } }],
      });
      await runner.executeRun(makeProvider(), scenario, makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.mcpServers).toBeDefined();
      expect((opts.mcpServers as Record<string, unknown>)['my-mcp']).toBeDefined();
    });

    it('omits agents when subagents is empty', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.agents).toBeUndefined();
    });

    it('omits mcpServers when mcpServers is empty', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.mcpServers).toBeUndefined();
    });

    it('handles run with no result message (findResultMessage returns undefined)', async () => {
      const msgs = [
        { type: 'assistant', message: {}, uuid: UUID, session_id: 's1', parent_tool_use_id: null },
      ];
      mockQueryFn.mockReturnValue(createMockQuery(msgs));
      const result = await runner.executeRun(makeProvider(), makeScenario(), makeTestRun(), createMockCallbacks());

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Unknown error — no result message');
    });

    it('passes thinking config for enabled mode', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const provider = makeProvider({ thinking: { kind: 'enabled', budgetTokens: 5000 } });
      await runner.executeRun(provider, makeScenario(), makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.thinking).toEqual({ type: 'enabled', budgetTokens: 5000 });
    });

    it('passes thinking config for disabled mode', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const provider = makeProvider({ thinking: { kind: 'disabled' } });
      await runner.executeRun(provider, makeScenario(), makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.thinking).toEqual({ type: 'disabled' });
    });

    it('omits thinking when not configured', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const provider = makeProvider({ thinking: undefined });
      await runner.executeRun(provider, makeScenario(), makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.thinking).toBeUndefined();
    });

    it('does not set allowDangerouslySkipPermissions for default mode', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const scenario = makeScenario({ permissionMode: 'default' });
      await runner.executeRun(makeProvider(), scenario, makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.allowDangerouslySkipPermissions).toBe(false);
    });

    it('does not include allowedTools when not set', async () => {
      mockQueryFn.mockReturnValue(createMockQuery([successResult()]));
      const scenario = makeScenario({ allowedTools: undefined });
      await runner.executeRun(makeProvider(), scenario, makeTestRun(), createMockCallbacks());

      const opts = (mockQueryFn.mock.calls[0][0] as { options: Record<string, unknown> }).options;
      expect(opts.allowedTools).toBeUndefined();
    });
  });
});
