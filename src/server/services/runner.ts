// ---------------------------------------------------------------------------
// ScenarioRunner — executes a single run via the Claude Agent SDK
// ---------------------------------------------------------------------------

import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  Options as SDKOptions,
  SDKMessage,
  ThinkingConfig as SDKThinkingConfig,
} from '@anthropic-ai/claude-agent-sdk';
import type { IRunner, RunCallbacks } from '../interfaces/runner.js';
import type { IWorkspaceBuilder } from '../interfaces/workspace.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Provider, Scenario, Run, SDKMessageRecord, ThinkingConfig } from '../types/index.js';
import { buildRunEnv } from './env-builder.js';
import { buildAgentsMap, buildMcpMap } from './agent-mapper.js';

// ---------------------------------------------------------------------------
// Thinking config conversion
// ---------------------------------------------------------------------------

function toSDKThinking(cfg: ThinkingConfig | undefined): SDKThinkingConfig | undefined {
  if (!cfg) return undefined;
  switch (cfg.kind) {
    case 'adaptive':
      return { type: 'adaptive' };
    case 'enabled':
      return { type: 'enabled', budgetTokens: cfg.budgetTokens };
    case 'disabled':
      return { type: 'disabled' };
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ScenarioRunner implements IRunner {
  constructor(
    private readonly workspace: IWorkspaceBuilder,
    private readonly logger: ILogger,
  ) {}

  async executeRun(
    provider: Provider,
    scenario: Scenario,
    run: Run,
    callbacks: RunCallbacks,
    externalAbortController?: AbortController,
  ): Promise<Run> {
    const startTime = Date.now();
    const messages: SDKMessageRecord[] = [];
    const abortController = externalAbortController ?? new AbortController();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let ws: { workspacePath: string; cleanup: () => Promise<void> } | undefined;

    try {
      // Create workspace first — timeout starts only after workspace is ready
      ws = await this.workspace.createWorkspace(scenario);

      // Set up timeout after workspace creation succeeds
      const timeoutMs = provider.timeoutSeconds * 1000;
      timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
      callbacks.onStatusChange('running');

      // Build SDK options — provider/model/thinking/effort from provider, agent config from scenario
      const env = buildRunEnv(provider.provider);
      const agents = await buildAgentsMap(scenario.subagents);
      const mcpServers = buildMcpMap(scenario.mcpServers);

      const options: SDKOptions = {
        cwd: ws.workspacePath,
        model: provider.provider.model,
        env,
        settingSources: ['project'],
        permissionMode: scenario.permissionMode,
        allowDangerouslySkipPermissions: scenario.permissionMode === 'bypassPermissions',
        sandbox: { enabled: true, autoAllowBashIfSandboxed: true },
        persistSession: false,
        abortController,
        maxTurns: scenario.maxTurns,
        thinking: toSDKThinking(provider.thinking),
        effort: provider.effort === 'none' ? undefined : provider.effort,
      };

      if (scenario.allowedTools && scenario.allowedTools.length > 0) {
        options.allowedTools = [...scenario.allowedTools];
      }

      if (scenario.disallowedTools && scenario.disallowedTools.length > 0) {
        options.disallowedTools = [...scenario.disallowedTools];
      }

      if (Object.keys(agents).length > 0) {
        options.agents = agents;
      }

      if (Object.keys(mcpServers).length > 0) {
        options.mcpServers = mcpServers;
      }

      // Execute query
      const q = query({ prompt: scenario.prompt, options });

      for await (const msg of q) {
        const record: SDKMessageRecord = {
          timestamp: new Date().toISOString(),
          message: msg as unknown as Record<string, unknown>,
        };
        messages.push(record);
        callbacks.onMessage(record);
      }

      // Find result message
      const resultMsg = this.findResultMessage(messages);
      const durationMs = Date.now() - startTime;

      if (resultMsg && resultMsg.subtype === 'success') {
        const successResult = resultMsg as ResultSuccessShape;
        const completedRun: Run = {
          ...run,
          status: 'completed',
          messages,
          resultText: successResult.result ?? '',
          totalCostUsd: successResult.total_cost_usd ?? 0,
          durationMs,
          numTurns: successResult.num_turns ?? 0,
          updatedAt: new Date().toISOString(),
        };
        callbacks.onStatusChange('completed');
        return completedRun;
      }

      // Error result
      const errorResult = resultMsg as ResultErrorShape | undefined;
      const failedRun: Run = {
        ...run,
        status: 'failed',
        messages,
        resultText: '',
        totalCostUsd: errorResult?.total_cost_usd ?? 0,
        durationMs,
        numTurns: errorResult?.num_turns ?? 0,
        error: errorResult?.errors?.join('; ') ?? 'Unknown error — no result message',
        updatedAt: new Date().toISOString(),
      };
      callbacks.onStatusChange('failed');
      return failedRun;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isAbort = abortController.signal.aborted;

      const errorRun: Run = {
        ...run,
        status: isAbort ? 'cancelled' : 'failed',
        messages,
        resultText: '',
        totalCostUsd: 0,
        durationMs,
        numTurns: 0,
        error: isAbort ? `Timeout after ${provider.timeoutSeconds}s` : errorMessage,
        updatedAt: new Date().toISOString(),
      };
      callbacks.onStatusChange(errorRun.status);
      return errorRun;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (ws) {
        await ws.cleanup().catch((cleanupErr) => {
          this.logger.warn('Failed to clean up workspace', {
            runId: run.id,
            error: String(cleanupErr),
          });
        });
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private findResultMessage(
    messages: readonly SDKMessageRecord[],
  ): ResultShape | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i].message;
      if (msg['type'] === 'result') {
        return msg as unknown as ResultShape;
      }
    }
    return undefined;
  }
}

// Internal shapes for extracting result fields from SDK messages

interface ResultSuccessShape {
  type: 'result';
  subtype: 'success';
  result: string;
  total_cost_usd: number;
  num_turns: number;
}

interface ResultErrorShape {
  type: 'result';
  subtype: string;
  total_cost_usd: number;
  num_turns: number;
  errors: string[];
}

type ResultShape = ResultSuccessShape | ResultErrorShape;
