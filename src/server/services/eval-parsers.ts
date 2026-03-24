// ---------------------------------------------------------------------------
// Evaluation Response Parsers — extract structured data from LLM responses
// ---------------------------------------------------------------------------

import type {
  IndividualEvaluation,
  InstructionCompliance,
  EvaluationSynthesis,
} from '../types/evaluation.js';

// ---------------------------------------------------------------------------
// Score response (Query 1)
// ---------------------------------------------------------------------------

export interface ScoreParseResult {
  readonly scores: Readonly<Record<string, number>>;
  readonly overallCloseness: number;
  readonly missedCritical: readonly string[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly summary: string;
}

export function parseScoreResponse(response: string): Partial<ScoreParseResult> {
  const parsed = tryParseJson<RawScoreResponse>(response);
  if (parsed) {
    return {
      scores: validScores(parsed.scores),
      overallCloseness: clamp01(parsed.overallCloseness),
      missedCritical: toStringArray(parsed.missedCritical),
      strengths: toStringArray(parsed.strengths),
      weaknesses: toStringArray(parsed.weaknesses),
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    };
  }
  return parseScoreFromText(response);
}

// ---------------------------------------------------------------------------
// Compliance response (Query 2)
// ---------------------------------------------------------------------------

export interface ComplianceParseResult {
  readonly followed: readonly string[];
  readonly violated: readonly string[];
  readonly notApplicable: readonly string[];
  readonly overallCompliance: number;
}

export function parseComplianceResponse(response: string): Partial<ComplianceParseResult> {
  const parsed = tryParseJson<RawComplianceResponse>(response);
  if (parsed) {
    return categorizeComplianceResults(parsed);
  }
  return parseComplianceFromText(response);
}

/** Convert parsed compliance into our InstructionCompliance type. */
export function toInstructionCompliance(
  result: Partial<ComplianceParseResult>,
): InstructionCompliance {
  return {
    followed: result.followed ?? [],
    violated: result.violated ?? [],
    notApplicable: result.notApplicable ?? [],
    overallCompliance: result.overallCompliance ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Synthesis response
// ---------------------------------------------------------------------------

export function parseSynthesisResponse(response: string): Partial<EvaluationSynthesis> {
  const parsed = tryParseJson<RawSynthesisResponse>(response);
  if (parsed) {
    return {
      dimensionScores: validScores(parsed.dimensionScores),
      weightedTotal: clampScore(parsed.weightedTotal),
      confidence: clamp01(parsed.confidence),
      dissenting: toStringArray(parsed.dissenting),
    };
  }
  return parseSynthesisFromText(response);
}

// ---------------------------------------------------------------------------
// Debate verdict parsing
// ---------------------------------------------------------------------------

export type Verdict = 'AGREE' | 'DISAGREE' | 'PARTIAL';

export interface DebateParseResult {
  readonly verdict: Verdict;
  readonly updatedScores: Readonly<Record<string, number>>;
  readonly critiques: readonly string[];
  readonly reasoning: string;
}

export function parseDebateResponse(response: string): Partial<DebateParseResult> {
  const parsed = tryParseJson<RawDebateResponse>(response);
  if (parsed) {
    return {
      verdict: parseVerdict(parsed.verdict),
      updatedScores: validScores(parsed.updatedScores),
      critiques: toStringArray(parsed.critiques),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
    };
  }
  return { verdict: 'PARTIAL' };
}

/** Convert score parse result into IndividualEvaluation entries. */
export function toIndividualEvaluations(
  scores: Readonly<Record<string, number>>,
  role: string,
  reasoningMap: Readonly<Record<string, string>>,
): IndividualEvaluation[] {
  return Object.entries(scores).map(([dimension, score]) => ({
    evaluatorRole: role,
    dimension,
    score: clampScore(score),
    reasoning: reasoningMap[dimension] ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Internal: JSON parsing
// ---------------------------------------------------------------------------

function tryParseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    // fall through
  }
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch {
      // fall through
    }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as T;
    } catch {
      // fall through
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Internal: Text fallback parsers
// ---------------------------------------------------------------------------

function parseScoreFromText(text: string): Partial<ScoreParseResult> {
  const scores: Record<string, number> = {};
  const scorePattern = /(\w[\w\s]*?):\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/g;
  let match: RegExpExecArray | null;
  while ((match = scorePattern.exec(text)) !== null) {
    const dim = match[1].trim();
    const val = parseFloat(match[2]);
    if (!isNaN(val) && val <= 10) scores[dim] = val;
  }
  return { scores: Object.keys(scores).length > 0 ? scores : undefined };
}

function parseComplianceFromText(text: string): Partial<ComplianceParseResult> {
  const followed: string[] = [];
  const violated: string[] = [];
  if (/followed|compliant/i.test(text)) followed.push('(extracted from text)');
  if (/violated|non-compliant/i.test(text)) violated.push('(extracted from text)');
  return { followed, violated, notApplicable: [], overallCompliance: undefined };
}

function parseSynthesisFromText(text: string): Partial<EvaluationSynthesis> {
  const scoreMatch = text.match(
    /weighted\s*(?:total|average|score)\s*:?\s*(\d+(?:\.\d+)?)/i,
  );
  return {
    weightedTotal: scoreMatch ? clampScore(parseFloat(scoreMatch[1])) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Internal: Raw response shapes
// ---------------------------------------------------------------------------

interface RawScoreResponse {
  scores?: Record<string, number>;
  overallCloseness?: number;
  missedCritical?: string[];
  strengths?: string[];
  weaknesses?: string[];
  summary?: string;
}

interface RawComplianceResponse {
  results?: Array<{ instruction?: string; status?: string; evidence?: string }>;
  overallCompliance?: number;
}

interface RawSynthesisResponse {
  dimensionScores?: Record<string, number>;
  weightedTotal?: number;
  confidence?: number;
  dissenting?: string[];
}

interface RawDebateResponse {
  verdict?: string;
  updatedScores?: Record<string, number>;
  critiques?: string[];
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Internal: Utilities
// ---------------------------------------------------------------------------

function validScores(
  scores: Record<string, number> | undefined,
): Record<string, number> {
  if (!scores || typeof scores !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === 'number' && !isNaN(v)) result[k] = clampScore(v);
  }
  return result;
}

function clamp01(val: number | undefined): number {
  if (val === undefined || isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

function clampScore(val: number | undefined): number {
  if (val === undefined || isNaN(val)) return 0;
  return Math.max(0, Math.min(10, val));
}

function toStringArray(arr: unknown): readonly string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === 'string');
}

function parseVerdict(val: unknown): Verdict {
  if (typeof val === 'string') {
    const upper = val.toUpperCase();
    if (upper === 'AGREE' || upper === 'DISAGREE' || upper === 'PARTIAL') {
      return upper;
    }
  }
  return 'PARTIAL';
}

function categorizeComplianceResults(
  parsed: RawComplianceResponse,
): Partial<ComplianceParseResult> {
  const followed: string[] = [];
  const violated: string[] = [];
  const notApplicable: string[] = [];

  if (Array.isArray(parsed.results)) {
    for (const r of parsed.results) {
      const text = r.instruction ?? '(unknown)';
      const status = (r.status ?? '').toLowerCase();
      if (status === 'followed') followed.push(text);
      else if (status === 'violated') violated.push(text);
      else notApplicable.push(text);
    }
  }

  return {
    followed,
    violated,
    notApplicable,
    overallCompliance: clamp01(parsed.overallCompliance),
  };
}
