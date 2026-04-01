// ---------------------------------------------------------------------------
// AiSdkRunner — executes a single run via Vercel AI SDK (streaming)
// ---------------------------------------------------------------------------

import { streamText, stepCountIs } from 'ai';
import type { IRunner, RunCallbacks } from '../interfaces/runner.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Provider, Scenario, Run, SDKMessageRecord } from '../types/index.js';
import { createModel } from './model-factory.js';
import { getEnabledTools } from './tools.js';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class AiSdkRunner implements IRunner {
  constructor(private readonly logger: ILogger) {}

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

    try {
      // Set up timeout
      const timeoutMs = provider.timeoutSeconds * 1000;
      timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
      callbacks.onStatusChange('running');

      // Build model and tools
      const model = createModel(provider);
      const tools = getEnabledTools(scenario.enabledTools);
      const hasTools = Object.keys(tools).length > 0;

      // Stream the query
      const result = streamText({
        model,
        system: scenario.systemPrompt || undefined,
        prompt: scenario.prompt,
        temperature: provider.temperature,
        maxOutputTokens: provider.maxTokens,
        topP: provider.topP,
        tools: hasTools ? tools : undefined,
        stopWhen: stepCountIs(hasTools ? 10 : 1),
        abortSignal: abortController.signal,
      });

      // Consume the stream, forwarding each part to the frontend via callbacks
      for await (const part of result.fullStream) {
        const record: SDKMessageRecord = {
          timestamp: new Date().toISOString(),
          message: part as unknown as Record<string, unknown>,
        };
        messages.push(record);
        callbacks.onMessage(record);
      }

      // Await final aggregated values
      const finalText = await result.text;
      const usage = await result.usage;
      const steps = await result.steps;
      const durationMs = Date.now() - startTime;

      const completedRun: Run = {
        ...run,
        status: 'completed',
        messages,
        resultText: finalText,
        totalCostUsd: 0,
        durationMs,
        numTurns: steps.length,
        updatedAt: new Date().toISOString(),
      };
      callbacks.onStatusChange('completed');

      this.logger.info('Run completed', {
        runId: run.id,
        durationMs,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        steps: steps.length,
      });

      return completedRun;
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
    }
  }
}
