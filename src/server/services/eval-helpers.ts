// ---------------------------------------------------------------------------
// Evaluation Helpers — result aggregation extracted from the orchestrator
// ---------------------------------------------------------------------------

import type {
  Scenario,
  AnswerComparison,
  CriticalPartResult,
  InstructionCompliance,
} from '../types/index.js';
import { toInstructionCompliance } from './eval-parsers.js';
import type { ScoreParseResult, ComplianceParseResult } from './eval-parsers.js';

/** Shared state accumulated per evaluator across rounds. */
export interface EvaluatorAccumulator {
  role: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  rounds: number;
  scoreResult: Partial<ScoreParseResult>;
  complianceResult: Partial<ComplianceParseResult>;
  assessmentText: string;
}

/** Check whether evaluator scores have converged (within 1 point per dimension). */
export function checkConsensus(accumulators: readonly EvaluatorAccumulator[]): boolean {
  if (accumulators.length < 2) return true;
  const allScores = accumulators
    .map((a) => a.scoreResult.scores ?? {})
    .filter((s) => Object.keys(s).length > 0);
  if (allScores.length < 2) return true;

  const dimensions = new Set(allScores.flatMap((s) => Object.keys(s)));
  for (const dim of dimensions) {
    const vals = allScores.map((s) => s[dim]).filter((v): v is number => v !== undefined);
    if (vals.length < 2) continue;
    const range = Math.max(...vals) - Math.min(...vals);
    if (range > 1) return false;
  }
  return true;
}

/** Aggregate answer closeness from all evaluators into a comparison. */
export function buildAnswerComparison(
  accumulators: readonly EvaluatorAccumulator[],
): AnswerComparison {
  const closenessValues = accumulators
    .map((a) => a.scoreResult.overallCloseness)
    .filter((v): v is number => v !== undefined && v > 0);
  const avgCloseness = closenessValues.length > 0
    ? closenessValues.reduce((a, b) => a + b, 0) / closenessValues.length
    : 0;
  const summaries = accumulators
    .map((a) => a.scoreResult.summary)
    .filter((s): s is string => !!s);

  return {
    matches: avgCloseness >= 0.7,
    explanation: summaries[0] ?? 'No explanation available',
    similarity: avgCloseness,
  };
}

/** Build critical requirement results by checking evaluator-flagged misses. */
export function buildCriticalResults(
  accumulators: readonly EvaluatorAccumulator[],
  scenario: Scenario,
): CriticalPartResult[] {
  const allMissed = new Set(
    accumulators.flatMap((a) => a.scoreResult.missedCritical ?? []),
  );
  return scenario.criticalRequirements.map((req) => ({
    requirement: req,
    met: !allMissed.has(req),
    evidence: allMissed.has(req) ? 'Flagged as missed by evaluator' : 'Not flagged',
  }));
}

/** Merge compliance results from all evaluators into a single report. */
export function mergeCompliance(
  accumulators: readonly EvaluatorAccumulator[],
): InstructionCompliance {
  const followed = new Set<string>();
  const violated = new Set<string>();
  const notApplicable = new Set<string>();
  let complianceSum = 0;
  let complianceCount = 0;

  for (const acc of accumulators) {
    const c = acc.complianceResult;
    (c.followed ?? []).forEach((s) => followed.add(s));
    (c.violated ?? []).forEach((s) => violated.add(s));
    (c.notApplicable ?? []).forEach((s) => notApplicable.add(s));
    if (c.overallCompliance !== undefined) {
      complianceSum += c.overallCompliance;
      complianceCount++;
    }
  }

  return toInstructionCompliance({
    followed: [...followed],
    violated: [...violated],
    notApplicable: [...notApplicable],
    overallCompliance: complianceCount > 0 ? complianceSum / complianceCount : 0,
  });
}
