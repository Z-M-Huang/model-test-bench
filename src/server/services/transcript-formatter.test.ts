import { describe, it, expect } from 'vitest';
import { formatTranscript } from './transcript-formatter.js';
import type { SDKMessageRecord } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers (shared with transcript-formatter-signals.test.ts via duplication
// since test helpers are intentionally colocated with tests)
// ---------------------------------------------------------------------------

function msg(message: Record<string, unknown>, timestamp = '2026-01-01T00:00:00Z'): SDKMessageRecord {
  return { timestamp, message };
}

function assistantMsg(text: string): SDKMessageRecord {
  return msg({
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
  });
}

function toolUseMsg(name: string, input: Record<string, unknown> = {}): SDKMessageRecord {
  return msg({ type: 'tool_use', name, input });
}

function toolResultMsg(content: string, isError = false): SDKMessageRecord {
  return msg({ type: 'tool_result', content, is_error: isError });
}

function resultMsg(result: string): SDKMessageRecord {
  return msg({ type: 'result', result });
}

// ---------------------------------------------------------------------------
// formatTranscript — message formatting
// ---------------------------------------------------------------------------

describe('formatTranscript', () => {
  it('returns empty text and summary for empty messages', () => {
    const result = formatTranscript([]);
    expect(result.text).toBe('');
    expect(result.summary.toolCallSequence).toEqual([]);
    expect(result.summary.filesRead).toEqual([]);
    expect(result.summary.filesModified).toEqual([]);
    expect(result.summary.commandFailures).toEqual([]);
    expect(result.summary.retryPatterns).toEqual([]);
    expect(result.summary.askedClarifyingQuestions).toBe(false);
  });

  describe('assistant messages', () => {
    it('formats assistant text blocks', () => {
      const result = formatTranscript([assistantMsg('Hello world')]);
      expect(result.text).toContain('[Assistant] Hello world');
    });

    it('joins multiple text blocks in a single assistant message', () => {
      const record = msg({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Part one' },
            { type: 'text', text: 'Part two' },
          ],
        },
      });
      const result = formatTranscript([record]);
      expect(result.text).toContain('[Assistant] Part one Part two');
    });

    it('skips assistant messages with no text content', () => {
      const record = msg({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: '123' }] },
      });
      const result = formatTranscript([record]);
      expect(result.text).toBe('');
    });

    it('skips assistant messages with no message field', () => {
      const record = msg({ type: 'assistant' });
      const result = formatTranscript([record]);
      expect(result.text).toBe('');
    });

    it('skips assistant messages with non-array content', () => {
      const record = msg({
        type: 'assistant',
        message: { content: 'not-an-array' },
      });
      const result = formatTranscript([record]);
      expect(result.text).toBe('');
    });
  });

  describe('tool use messages', () => {
    it('formats tool use with name and input', () => {
      const result = formatTranscript([
        toolUseMsg('Read', { file_path: '/src/index.ts' }),
      ]);
      expect(result.text).toContain('[Tool Call] Read:');
      expect(result.summary.toolCallSequence).toEqual(['Read']);
    });

    it('uses unknown_tool when name is missing', () => {
      const record = msg({ type: 'tool_use', input: {} });
      const result = formatTranscript([record]);
      expect(result.text).toContain('[Tool Call] unknown_tool:');
    });

    it('truncates tool input at 500 chars', () => {
      const longInput = { data: 'x'.repeat(600) };
      const result = formatTranscript([toolUseMsg('Bash', longInput)]);
      expect(result.text).toContain('...');
    });
  });

  describe('tool result messages', () => {
    it('formats successful tool result', () => {
      const result = formatTranscript([toolResultMsg('File contents here')]);
      expect(result.text).toContain('[Tool Result] File contents here');
    });

    it('formats error tool result', () => {
      const result = formatTranscript([toolResultMsg('ENOENT', true)]);
      expect(result.text).toContain('[Tool Error] ENOENT');
      expect(result.summary.commandFailures).toEqual(['ENOENT']);
    });

    it('truncates tool output at 500 chars', () => {
      const longOutput = 'y'.repeat(600);
      const result = formatTranscript([toolResultMsg(longOutput)]);
      expect(result.text).toContain('...');
    });

    it('extracts text from array content in tool result', () => {
      const record = msg({
        type: 'tool_result',
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
      });
      const result = formatTranscript([record]);
      expect(result.text).toContain('First part Second part');
    });

    it('handles missing content in tool result', () => {
      const record = msg({ type: 'tool_result' });
      const result = formatTranscript([record]);
      expect(result.text).toContain('[Tool Result]');
    });
  });

  describe('result messages', () => {
    it('formats final result', () => {
      const result = formatTranscript([resultMsg('Task completed successfully')]);
      expect(result.text).toContain('[Final Result] Task completed successfully');
    });

    it('skips result message with empty result', () => {
      const record = msg({ type: 'result', result: '' });
      const result = formatTranscript([record]);
      expect(result.text).toBe('');
    });

    it('skips result message with missing result field', () => {
      const record = msg({ type: 'result' });
      const result = formatTranscript([record]);
      expect(result.text).toBe('');
    });
  });

  it('ignores unrecognized message types', () => {
    const record = msg({ type: 'unknown_type', data: 'stuff' });
    const result = formatTranscript([record]);
    expect(result.text).toBe('');
  });

  describe('clarifying questions', () => {
    it('detects clarifying questions in assistant messages', () => {
      const result = formatTranscript([assistantMsg('Could you clarify the requirements?')]);
      expect(result.summary.askedClarifyingQuestions).toBe(true);
    });

    it('does not flag non-question text', () => {
      const result = formatTranscript([assistantMsg('I will proceed with the task.')]);
      expect(result.summary.askedClarifyingQuestions).toBe(false);
    });
  });

  describe('full scenario', () => {
    it('produces coherent transcript from mixed messages', () => {
      const messages: SDKMessageRecord[] = [
        assistantMsg('Let me read the file.'),
        toolUseMsg('Read', { file_path: '/src/app.ts' }),
        toolResultMsg('export function main() {}'),
        assistantMsg('I see the main function. Let me edit it.'),
        toolUseMsg('Edit', { file_path: '/src/app.ts' }),
        toolResultMsg('File edited successfully'),
        resultMsg('Task completed.'),
      ];
      const result = formatTranscript(messages);

      expect(result.text).toContain('[Assistant] Let me read the file.');
      expect(result.text).toContain('[Tool Call] Read:');
      expect(result.text).toContain('[Tool Result]');
      expect(result.text).toContain('[Final Result] Task completed.');
      expect(result.summary.toolCallSequence).toEqual(['Read', 'Edit']);
      expect(result.summary.filesRead).toContain('/src/app.ts');
      expect(result.summary.filesModified).toContain('/src/app.ts');
      expect(result.summary.askedClarifyingQuestions).toBe(false);
    });
  });

  describe('AI SDK step messages', () => {
    function stepMsg(text: string, toolCalls: Record<string, unknown>[] = [], toolResults: Record<string, unknown>[] = []): SDKMessageRecord {
      return msg({ type: 'step', text, toolCalls, toolResults, usage: { promptTokens: 10, completionTokens: 5 } });
    }

    it('formats step text as assistant message', () => {
      const result = formatTranscript([stepMsg('Hello from AI SDK')]);
      expect(result.text).toContain('[Assistant] Hello from AI SDK');
    });

    it('formats tool calls from steps', () => {
      const result = formatTranscript([stepMsg('', [
        { toolName: 'read_file', args: { path: '/src/app.ts' }, toolCallId: '1' },
      ])]);
      expect(result.text).toContain('[Tool Call] read_file:');
      expect(result.summary.toolCallSequence).toEqual(['read_file']);
    });

    it('formats tool results from steps', () => {
      const result = formatTranscript([stepMsg('', [], [
        { toolName: 'read_file', result: 'file contents here', toolCallId: '1' },
      ])]);
      expect(result.text).toContain('[Tool Result] file contents here');
    });

    it('tracks file access from step tool calls via args', () => {
      const result = formatTranscript([stepMsg('', [
        { toolName: 'Read', args: { path: '/src/index.ts' }, toolCallId: '1' },
      ])]);
      expect(result.summary.filesRead).toContain('/src/index.ts');
    });

    it('handles step with text and tool calls together', () => {
      const result = formatTranscript([stepMsg('Let me read that file.', [
        { toolName: 'read_file', args: { path: '/a.ts' }, toolCallId: '1' },
      ], [
        { toolName: 'read_file', result: 'contents', toolCallId: '1' },
      ])]);
      expect(result.text).toContain('[Assistant] Let me read that file.');
      expect(result.text).toContain('[Tool Call] read_file:');
      expect(result.text).toContain('[Tool Result] contents');
    });

    it('skips step with empty text and no tool calls', () => {
      const result = formatTranscript([stepMsg('')]);
      expect(result.text).toBe('');
    });

    it('detects clarifying questions in step text', () => {
      const result = formatTranscript([stepMsg('What do you want me to do?')]);
      expect(result.summary.askedClarifyingQuestions).toBe(true);
    });
  });
});
