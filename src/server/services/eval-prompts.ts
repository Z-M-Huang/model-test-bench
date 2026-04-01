// ---------------------------------------------------------------------------
// Evaluation Prompt Builders
// ---------------------------------------------------------------------------

import type { Scenario, ScoringDimension, Provider } from '../types/index.js';
import type { IndividualEvaluation } from '../types/evaluation.js';
import type { TranscriptSummary } from './transcript-formatter.js';
import type { InstructionBlock } from './instruction-parser.js';

// ---------------------------------------------------------------------------
// Query 1: Score + answer comparison prompt
// ---------------------------------------------------------------------------

export function buildScorePrompt(
  transcript: string,
  scenario: Scenario,
  summary: TranscriptSummary,
): string {
  const dimensions = formatDimensions(scenario.scoringDimensions);
  const toolSequence = summary.toolCallSequence.length > 0
    ? `Tool call sequence: ${summary.toolCallSequence.join(' → ')}`
    : 'No tool calls recorded.';

  return `You are an expert evaluator assessing an AI agent's performance on a task.

## Task Description
${scenario.prompt}

## Expected Answer
${scenario.expectedAnswer}

## Critical Requirements
${formatCriticalRequirements(scenario.criticalRequirements)}

## Grading Guidelines
${scenario.gradingGuidelines || 'No specific grading guidelines provided.'}

## Scoring Dimensions
${dimensions}

## Agent Behavior Summary
${toolSequence}
Files read: ${summary.filesRead.length > 0 ? summary.filesRead.join(', ') : 'none'}
Files modified: ${summary.filesModified.length > 0 ? summary.filesModified.join(', ') : 'none'}
Command failures: ${summary.commandFailures.length}
Asked clarifying questions: ${summary.askedClarifyingQuestions ? 'yes' : 'no'}

## Full Transcript
${transcript}

## Instructions
Evaluate the agent's output. For each scoring dimension, provide a score from 0-10.
Also assess how closely the agent's final answer matches the expected answer (0.0-1.0).
Identify any critical requirements that were missed, as well as strengths and weaknesses.

Respond with valid JSON matching this structure:
{
  "scores": { "<dimension_name>": <0-10>, ... },
  "overallCloseness": <0.0-1.0>,
  "missedCritical": ["<requirement that was not met>", ...],
  "strengths": ["<strength>", ...],
  "weaknesses": ["<weakness>", ...],
  "summary": "<brief overall assessment>"
}`;
}

// ---------------------------------------------------------------------------
// Query 2: Instruction compliance prompt
// ---------------------------------------------------------------------------

export function buildCompliancePrompt(
  transcript: string,
  scenario: Scenario,
  instructions: readonly InstructionBlock[],
): string {
  const instructionList = instructions
    .map((b, i) => `${i + 1}. [${b.source}] ${b.text}`)
    .join('\n');

  return `You are an expert evaluator checking whether an AI agent followed its configured instructions.

## Instructions to Check
${instructionList || 'No instructions configured.'}

## Agent Transcript
${transcript}

## Instructions
For each instruction listed above, determine if the agent:
- "followed" it (clear evidence of compliance)
- "violated" it (clear evidence of non-compliance)
- "not_applicable" (instruction was not relevant to this task)

Also rate overall compliance from 0.0 to 1.0.

Respond with valid JSON:
{
  "results": [
    { "instruction": "<instruction text>", "status": "followed|violated|not_applicable", "evidence": "<brief evidence>" }
  ],
  "overallCompliance": <0.0-1.0>
}`;
}

// ---------------------------------------------------------------------------
// Multi-round debate prompt
// ---------------------------------------------------------------------------

export function buildDebatePrompt(
  myPreviousAssessment: string,
  otherAssessments: readonly string[],
  roundNumber: number,
): string {
  const othersFormatted = otherAssessments
    .map((a, i) => `### Other Evaluator ${i + 1}\n${a}`)
    .join('\n\n');

  return `You are participating in round ${roundNumber} of a multi-evaluator review.

## Your Previous Assessment
${myPreviousAssessment}

## Other Evaluators' Assessments
${othersFormatted}

## Instructions
Review the other evaluators' assessments and compare them with your own.
Determine if you agree, partially agree, or disagree with the emerging consensus.
Provide your updated scores if you have changed your mind, and explain why.

Respond with valid JSON:
{
  "verdict": "AGREE|DISAGREE|PARTIAL",
  "updatedScores": { "<dimension_name>": <0-10>, ... },
  "critiques": ["<specific point of disagreement>", ...],
  "reasoning": "<why you agree/disagree>"
}`;
}

// ---------------------------------------------------------------------------
// Synthesis prompt (final aggregation)
// ---------------------------------------------------------------------------

export function buildSynthesisPrompt(
  allEvaluations: readonly IndividualEvaluation[],
  scenario: Scenario,
  provider: Provider,
): string {
  const evalSummaries = allEvaluations
    .map((e) => `[${e.evaluatorRole}] ${e.dimension}: ${e.score}/10 — ${e.reasoning}`)
    .join('\n');

  const dimensions = formatDimensions(scenario.scoringDimensions);

  return `You are the final synthesizer for a multi-evaluator assessment.

## Scenario
${scenario.name}: ${scenario.prompt}

## Scoring Dimensions & Weights
${dimensions}

## Provider
Name: ${provider.name}
Model: ${provider.model}

## All Individual Evaluations
${evalSummaries}

## Instructions
Synthesize all evaluations into final scores. Weight each dimension according to the scoring
dimensions defined above. Identify areas of evaluator consensus and disagreement.
Provide a confidence level (0.0-1.0) based on evaluator agreement.

Respond with valid JSON:
{
  "dimensionScores": { "<dimension_name>": <0-10>, ... },
  "weightedTotal": <weighted average 0-10>,
  "confidence": <0.0-1.0>,
  "dissenting": ["<areas where evaluators disagreed>", ...]
}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatDimensions(dims: readonly ScoringDimension[]): string {
  if (dims.length === 0) return 'No dimensions defined. Use general quality assessment.';
  return dims
    .map((d) => `- ${d.name} (weight: ${d.weight}): ${d.description}`)
    .join('\n');
}

function formatCriticalRequirements(reqs: readonly string[]): string {
  if (reqs.length === 0) return 'None specified.';
  return reqs.map((r, i) => `${i + 1}. ${r}`).join('\n');
}
