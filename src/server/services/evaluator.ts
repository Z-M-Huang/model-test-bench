// ---------------------------------------------------------------------------
// Evaluator — orchestrates evaluation pipeline via SDK query()
// ---------------------------------------------------------------------------

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { IEvaluator, EvaluationCallbacks } from '../interfaces/evaluator.js';
import type {
  Run,
  Scenario,
  TestSetup,
  Evaluation,
  EvaluationRequest,
  EvaluatorConfig,
  EvaluationRound,
  EvaluatorLedger,
  IndividualEvaluation,
} from '../types/index.js';
import { buildRunEnv } from './env-builder.js';
import { formatTranscript } from './transcript-formatter.js';
import { parseAllInstructions } from './instruction-parser.js';
import {
  buildScorePrompt,
  buildCompliancePrompt,
  buildDebatePrompt,
  buildSynthesisPrompt,
} from './eval-prompts.js';
import {
  parseScoreResponse,
  parseComplianceResponse,
  parseSynthesisResponse,
  parseDebateResponse,
  toIndividualEvaluations,
} from './eval-parsers.js';
import {
  checkConsensus,
  buildAnswerComparison,
  buildCriticalResults,
  mergeCompliance,
} from './eval-helpers.js';
import type { EvaluatorAccumulator } from './eval-helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueryResultMessage {
  readonly type: 'result';
  readonly subtype: string;
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly num_turns?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class EvaluationOrchestrator implements IEvaluator {
  async evaluateRun(
    run: Run,
    scenario: Scenario,
    setup: TestSetup,
    request: EvaluationRequest,
    callbacks: EvaluationCallbacks,
  ): Promise<Evaluation> {
    callbacks.onStatusChange('running');

    const { text: transcript, summary } = formatTranscript(run.messages);
    const instructions = parseAllInstructions([
      ...setup.claudeMdFiles.map((c) => ({ content: c.content, source: `CLAUDE.md (${c.role})` })),
      ...setup.rules.map((r) => ({ content: r.content, source: `rule:${r.name}` })),
    ]);

    const accumulators: EvaluatorAccumulator[] = request.evaluators.map((e) => ({
      role: e.role, costUsd: 0, tokensIn: 0, tokensOut: 0, rounds: 0,
      scoreResult: {}, complianceResult: {}, assessmentText: '',
    }));

    // ── Round 1 ──────────────────────────────────────────────────────
    const round1Evals = await this.runRound1(
      request.evaluators, accumulators, transcript, scenario, setup, instructions, summary,
    );
    const rounds: EvaluationRound[] = [{
      roundNumber: 1, evaluations: round1Evals,
      consensusReached: request.maxRounds <= 1, timestamp: new Date().toISOString(),
    }];

    // ── Multi-round debate ───────────────────────────────────────────
    if (request.maxRounds > 1) {
      for (let roundNum = 2; roundNum <= request.maxRounds; roundNum++) {
        const debateEvals = await this.runDebateRound(request.evaluators, accumulators, roundNum);
        const consensus = checkConsensus(accumulators);
        rounds.push({
          roundNumber: roundNum, evaluations: debateEvals,
          consensusReached: consensus, timestamp: new Date().toISOString(),
        });
        if (consensus) break;
      }
    }

    // ── Synthesis ────────────────────────────────────────────────────
    const allEvals = rounds.flatMap((r) => r.evaluations);
    const synthesizer = request.evaluators[request.evaluators.length - 1];
    const synthResult = await this.runSynthesis(synthesizer, allEvals, scenario, setup, accumulators);

    // ── Assemble final evaluation ────────────────────────────────────
    const ledger: EvaluatorLedger[] = accumulators.map((a) => ({
      evaluatorRole: a.role, totalCostUsd: a.costUsd,
      totalTokensIn: a.tokensIn, totalTokensOut: a.tokensOut, roundsParticipated: a.rounds,
    }));
    const now = new Date().toISOString();
    callbacks.onStatusChange('completed');

    return {
      id: '', runId: run.id, status: 'completed', evaluators: request.evaluators, rounds,
      answerComparison: buildAnswerComparison(accumulators),
      criticalResults: buildCriticalResults(accumulators, scenario),
      setupCompliance: { instructionCompliance: mergeCompliance(accumulators), skillUsage: [], subagentUsage: [] },
      synthesis: {
        dimensionScores: synthResult.dimensionScores ?? {}, weightedTotal: synthResult.weightedTotal ?? 0,
        confidence: synthResult.confidence ?? 0, dissenting: synthResult.dissenting ?? [],
      },
      ledger, totalCostUsd: ledger.reduce((sum, l) => sum + l.totalCostUsd, 0),
      createdAt: now, updatedAt: now,
    };
  }

  // ─── Round 1: Score + Compliance ─────────────────────────────────────

  private async runRound1(
    evaluators: readonly EvaluatorConfig[],
    accumulators: EvaluatorAccumulator[],
    transcript: string,
    scenario: Scenario,
    setup: TestSetup,
    instructions: ReturnType<typeof parseAllInstructions>,
    summary: ReturnType<typeof formatTranscript>['summary'],
  ): Promise<IndividualEvaluation[]> {
    const promises = evaluators.map(async (evaluator, idx) => {
      const acc = accumulators[idx];
      acc.rounds++;
      const scoreResp = await this.runQuery(evaluator, buildScorePrompt(transcript, scenario, summary));
      acc.costUsd += scoreResp.costUsd;
      acc.scoreResult = parseScoreResponse(scoreResp.text);
      acc.assessmentText = scoreResp.text;
      const compResp = await this.runQuery(evaluator, buildCompliancePrompt(transcript, setup, instructions));
      acc.costUsd += compResp.costUsd;
      acc.complianceResult = parseComplianceResponse(compResp.text);
      return toIndividualEvaluations(acc.scoreResult.scores ?? {}, evaluator.role, {});
    });
    return (await Promise.all(promises)).flat();
  }

  // ─── Multi-round debate ──────────────────────────────────────────────

  private async runDebateRound(
    evaluators: readonly EvaluatorConfig[],
    accumulators: EvaluatorAccumulator[],
    roundNumber: number,
  ): Promise<IndividualEvaluation[]> {
    const promises = evaluators.map(async (evaluator, idx) => {
      const acc = accumulators[idx];
      acc.rounds++;
      const others = accumulators.filter((_, i) => i !== idx).map((a) => a.assessmentText);
      const resp = await this.runQuery(evaluator, buildDebatePrompt(acc.assessmentText, others, roundNumber));
      acc.costUsd += resp.costUsd;
      const result = parseDebateResponse(resp.text);
      if (result.updatedScores && Object.keys(result.updatedScores).length > 0) {
        acc.scoreResult = { ...acc.scoreResult, scores: result.updatedScores };
      }
      acc.assessmentText = resp.text;
      return toIndividualEvaluations(acc.scoreResult.scores ?? {}, evaluator.role, {});
    });
    return (await Promise.all(promises)).flat();
  }

  // ─── Synthesis ───────────────────────────────────────────────────────

  private async runSynthesis(
    synthesizer: EvaluatorConfig,
    allEvals: readonly IndividualEvaluation[],
    scenario: Scenario,
    setup: TestSetup,
    accumulators: EvaluatorAccumulator[],
  ): Promise<ReturnType<typeof parseSynthesisResponse>> {
    const resp = await this.runQuery(synthesizer, buildSynthesisPrompt(allEvals, scenario, setup));
    const acc = accumulators.find((a) => a.role === synthesizer.role);
    if (acc) acc.costUsd += resp.costUsd;
    return parseSynthesisResponse(resp.text);
  }

  // ─── SDK query wrapper ───────────────────────────────────────────────

  private async runQuery(
    evaluator: EvaluatorConfig,
    prompt: string,
  ): Promise<{ text: string; costUsd: number }> {
    const q = query({
      prompt,
      options: {
        env: buildRunEnv(evaluator.provider),
        model: evaluator.provider.model,
        tools: [],
        maxTurns: 3,
        permissionMode: 'dontAsk',
        persistSession: false,
      },
    });

    let resultText = '';
    let costUsd = 0;

    for await (const msg of q) {
      const record = msg as unknown as Record<string, unknown>;
      if (record['type'] === 'result') {
        const resultMsg = record as unknown as QueryResultMessage;
        resultText = resultMsg.result ?? '';
        costUsd = resultMsg.total_cost_usd ?? 0;
      }
    }

    return { text: resultText, costUsd };
  }
}
