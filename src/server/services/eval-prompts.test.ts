import { describe, it, expect } from 'vitest';
import {
  buildScorePrompt,
  buildCompliancePrompt,
  buildDebatePrompt,
  buildSynthesisPrompt,
} from './eval-prompts.js';
import { makeScenario, makeProvider } from './storage-test-helpers.js';
import type { TranscriptSummary } from './transcript-formatter.js';

function mkSummary(overrides: Partial<TranscriptSummary> = {}): TranscriptSummary {
  return {
    toolCallSequence: [],
    filesRead: [],
    filesModified: [],
    commandFailures: [],
    retryPatterns: [],
    askedClarifyingQuestions: false,
    ...overrides,
  };
}

describe('buildScorePrompt', () => {
  it('includes "No tool calls recorded" when tool sequence is empty', () => {
    const prompt = buildScorePrompt('transcript', makeScenario(), mkSummary());
    expect(prompt).toContain('No tool calls recorded');
  });

  it('includes tool call sequence when present', () => {
    const summary = mkSummary({ toolCallSequence: ['Read', 'Edit'] });
    const prompt = buildScorePrompt('transcript', makeScenario(), summary);
    expect(prompt).toContain('Tool call sequence: Read');
  });

  it('uses default grading guidelines text when none provided', () => {
    const scenario = makeScenario({ gradingGuidelines: '' });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('No specific grading guidelines');
  });

  it('includes grading guidelines when provided', () => {
    const scenario = makeScenario({ gradingGuidelines: 'Be strict.' });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('Be strict.');
  });

  it('handles empty scoring dimensions', () => {
    const scenario = makeScenario({ scoringDimensions: [] });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('No dimensions defined');
  });

  it('formats scoring dimensions with weights', () => {
    const scenario = makeScenario({
      scoringDimensions: [{ name: 'quality', weight: 0.5, description: 'How good' }],
    });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('quality (weight: 0.5)');
  });

  it('formats files read and modified', () => {
    const summary = mkSummary({
      filesRead: ['/src/a.ts'],
      filesModified: ['/src/b.ts'],
    });
    const prompt = buildScorePrompt('transcript', makeScenario(), summary);
    expect(prompt).toContain('Files read: /src/a.ts');
    expect(prompt).toContain('Files modified: /src/b.ts');
  });

  it('shows "none" for empty files lists', () => {
    const prompt = buildScorePrompt('transcript', makeScenario(), mkSummary());
    expect(prompt).toContain('Files read: none');
    expect(prompt).toContain('Files modified: none');
  });

  it('shows critical requirements', () => {
    const scenario = makeScenario({ criticalRequirements: ['Must be fast'] });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('1. Must be fast');
  });

  it('shows "None specified" for empty critical requirements', () => {
    const scenario = makeScenario({ criticalRequirements: [] });
    const prompt = buildScorePrompt('transcript', scenario, mkSummary());
    expect(prompt).toContain('None specified');
  });

  it('shows clarifying questions status', () => {
    const summary = mkSummary({ askedClarifyingQuestions: true });
    const prompt = buildScorePrompt('transcript', makeScenario(), summary);
    expect(prompt).toContain('Asked clarifying questions: yes');
  });
});

describe('buildCompliancePrompt', () => {
  it('lists instruction blocks', () => {
    const instructions = [{ source: 'rules', text: 'Always test' }];
    const prompt = buildCompliancePrompt('transcript', makeScenario(), instructions);
    expect(prompt).toContain('1. [rules] Always test');
  });

  it('shows "No instructions configured" when empty', () => {
    const prompt = buildCompliancePrompt('transcript', makeScenario(), []);
    expect(prompt).toContain('No instructions configured');
  });

  it('does not include skills or subagents sections', () => {
    const prompt = buildCompliancePrompt('transcript', makeScenario(), []);
    expect(prompt).not.toContain('Skills:');
    expect(prompt).not.toContain('Subagents:');
  });
});

describe('buildDebatePrompt', () => {
  it('formats round number and other assessments', () => {
    const prompt = buildDebatePrompt('My assessment', ['Other eval'], 2);
    expect(prompt).toContain('round 2');
    expect(prompt).toContain('My assessment');
    expect(prompt).toContain('Other Evaluator 1');
    expect(prompt).toContain('Other eval');
  });
});

describe('buildSynthesisPrompt', () => {
  it('formats all evaluations and provider details', () => {
    const evals = [
      { evaluatorRole: 'primary', dimension: 'quality', score: 8, reasoning: 'Good' },
    ];
    const prompt = buildSynthesisPrompt(evals, makeScenario(), makeProvider());
    expect(prompt).toContain('[primary] quality: 8/10');
    expect(prompt).toContain('Test Provider');
  });
});
