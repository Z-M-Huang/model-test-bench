// ---------------------------------------------------------------------------
// Evaluator — orchestrates evaluation pipeline via Vercel AI SDK
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import type { IEvaluator, EvaluationCallbacks, EvalMessageInfo } from '../interfaces/evaluator.js';
import type {
  Run,
  Scenario,
  Provider,
  Evaluation,
  EvaluationRequest,
  EvaluatorConfig,
  EvaluationRound,
  EvaluatorLedger,
  IndividualEvaluation,
  SDKMessageRecord,
} from '../types/index.js';
import { createModel } from './model-factory.js';
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
// Implementation
// ---------------------------------------------------------------------------

export class EvaluationOrchestrator implements IEvaluator {
  async evaluateRun(
    run: Run,
    scenario: Scenario,
    provider: Provider,
    request: EvaluationRequest,
    callbacks: EvaluationCallbacks,
  ): Promise<Evaluation> {
    callbacks.onStatusChange('running');
    callbacks.onProgress('preparing', 'Formatting transcript and parsing instructions...');

    const { text: transcript, summary } = formatTranscript(run.messages);
    const instructions = parseAllInstructions(
      scenario.systemPrompt
        ? [{ content: scenario.systemPrompt, source: 'system_prompt' }]
        : [],
    );

    const accumulators: EvaluatorAccumulator[] = request.evaluators.map((e) => ({
      role: e.role, costUsd: 0, tokensIn: 0, tokensOut: 0, rounds: 0,
      scoreResult: {}, complianceResult: {}, assessmentText: '',
    }));

    // ── Round 1 ──────────────────────────────────────────────────────
    callbacks.onProgress('scoring', `Running score and compliance queries (${request.evaluators.length} evaluator${request.evaluators.length > 1 ? 's' : ''})...`);
    const round1Evals = await this.runRound1(
      request.evaluators, accumulators, transcript, scenario, provider, instructions, summary, callbacks,
    );
    const round1Consensus = request.maxRounds <= 1 || checkConsensus(accumulators);
    const rounds: EvaluationRound[] = [{
      roundNumber: 1, evaluations: round1Evals,
      consensusReached: round1Consensus, timestamp: new Date().toISOString(),
    }];

    // ── Multi-round debate ───────────────────────────────────────────
    if (request.maxRounds > 1 && !round1Consensus) {
      for (let roundNum = 2; roundNum <= request.maxRounds; roundNum++) {
        callbacks.onProgress('debate', `Debate round ${roundNum} of ${request.maxRounds}...`);
        const debateEvals = await this.runDebateRound(request.evaluators, accumulators, roundNum, callbacks);
        const consensus = checkConsensus(accumulators);
        rounds.push({
          roundNumber: roundNum, evaluations: debateEvals,
          consensusReached: consensus, timestamp: new Date().toISOString(),
        });
        if (consensus) break;
      }
    }

    // ── Synthesis ────────────────────────────────────────────────────
    callbacks.onProgress('synthesis', 'Synthesizing final scores and confidence...');
    const latestRound = rounds[rounds.length - 1];
    const latestEvals = latestRound.evaluations;
    const synthesizer = request.evaluators[request.evaluators.length - 1];
    const synthInfo: EvalMessageInfo = { phase: 'synthesis', evaluatorRole: synthesizer.role, roundNumber: rounds.length };
    const synthResult = await this.runSynthesis(synthesizer, latestEvals, scenario, provider, accumulators, callbacks, synthInfo);

    // ── Assemble final evaluation ────────────────────────────────────
    const ledger: EvaluatorLedger[] = accumulators.map((a) => ({
      evaluatorRole: a.role, totalCostUsd: a.costUsd,
      totalTokensIn: a.tokensIn, totalTokensOut: a.tokensOut, roundsParticipated: a.rounds,
    }));
    const now = new Date().toISOString();
    callbacks.onProgress('complete', 'Evaluation finished.');
    callbacks.onStatusChange('completed');

    return {
      id: '', runId: run.id, status: 'completed', evaluators: request.evaluators, rounds,
      answerComparison: buildAnswerComparison(accumulators),
      criticalResults: buildCriticalResults(accumulators, scenario),
      setupCompliance: { instructionCompliance: mergeCompliance(accumulators) },
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
    provider: Provider,
    instructions: ReturnType<typeof parseAllInstructions>,
    summary: ReturnType<typeof formatTranscript>['summary'],
    callbacks: EvaluationCallbacks,
  ): Promise<IndividualEvaluation[]> {
    const promises = evaluators.map(async (evaluator, idx) => {
      const acc = accumulators[idx];
      acc.rounds++;
      const scoreInfo: EvalMessageInfo = { phase: 'score', evaluatorRole: evaluator.role, roundNumber: 1 };
      const scoreResp = await this.runQuery(evaluator, buildScorePrompt(transcript, scenario, summary), callbacks, scoreInfo);
      acc.costUsd += scoreResp.costUsd;
      acc.scoreResult = parseScoreResponse(scoreResp.text);
      acc.assessmentText = scoreResp.text;
      const compInfo: EvalMessageInfo = { phase: 'compliance', evaluatorRole: evaluator.role, roundNumber: 1 };
      const compResp = await this.runQuery(evaluator, buildCompliancePrompt(transcript, scenario, instructions), callbacks, compInfo);
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
    callbacks: EvaluationCallbacks,
  ): Promise<IndividualEvaluation[]> {
    const promises = evaluators.map(async (evaluator, idx) => {
      const acc = accumulators[idx];
      acc.rounds++;
      const others = accumulators.filter((_, i) => i !== idx).map((a) => a.assessmentText);
      const info: EvalMessageInfo = { phase: 'debate', evaluatorRole: evaluator.role, roundNumber };
      const resp = await this.runQuery(evaluator, buildDebatePrompt(acc.assessmentText, others, roundNumber), callbacks, info);
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
    provider: Provider,
    accumulators: EvaluatorAccumulator[],
    callbacks: EvaluationCallbacks,
    info: EvalMessageInfo,
  ): Promise<ReturnType<typeof parseSynthesisResponse>> {
    const resp = await this.runQuery(synthesizer, buildSynthesisPrompt(allEvals, scenario, provider), callbacks, info);
    const acc = accumulators.find((a) => a.role === synthesizer.role);
    if (acc) acc.costUsd += resp.costUsd;
    return parseSynthesisResponse(resp.text);
  }

  // ─── AI SDK query wrapper ─────────────────────────────────────────────

  private async runQuery(
    evaluator: EvaluatorConfig,
    prompt: string,
    callbacks: EvaluationCallbacks,
    info: EvalMessageInfo,
  ): Promise<{ text: string; costUsd: number }> {
    const model = createModel({
      providerName: evaluator.providerName,
      model: evaluator.model,
      apiKey: evaluator.apiKey,
      baseUrl: evaluator.baseUrl,
    });

    const result = await generateText({ model, prompt, maxOutputTokens: 4096 });

    const record: SDKMessageRecord = {
      timestamp: new Date().toISOString(),
      message: {
        type: 'eval_response',
        text: result.text,
        usage: result.usage,
      } as unknown as Record<string, unknown>,
    };
    callbacks.onMessage(info, record);

    // Token-based cost calculation (provider-specific pricing TBD)
    const costUsd = 0;
    return { text: result.text, costUsd };
  }
}
