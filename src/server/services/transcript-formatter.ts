// ---------------------------------------------------------------------------
// Transcript Formatter — converts SDK messages into evaluator-readable text
// ---------------------------------------------------------------------------

import type { SDKMessageRecord } from '../types/index.js';

const MAX_TRANSCRIPT_CHARS = 100_000;
const TRUNCATED_MARKER = '\n[transcript truncated]';
const MAX_TOOL_INPUT_CHARS = 500;
const MAX_TOOL_OUTPUT_CHARS = 500;

/** Structured summary extracted from a transcript. */
export interface TranscriptSummary {
  readonly toolCallSequence: readonly string[];
  readonly filesRead: readonly string[];
  readonly filesModified: readonly string[];
  readonly commandFailures: readonly string[];
  readonly retryPatterns: readonly string[];
  readonly askedClarifyingQuestions: boolean;
}

/** Full transcript output. */
export interface TranscriptResult {
  readonly text: string;
  readonly summary: TranscriptSummary;
}

/** Format SDK messages into a readable transcript and structured summary. */
export function formatTranscript(messages: readonly SDKMessageRecord[]): TranscriptResult {
  const lines: string[] = [];
  const toolCalls: string[] = [];
  const filesRead: Set<string> = new Set();
  const filesModified: Set<string> = new Set();
  const commandFailures: string[] = [];
  const retryPatterns: string[] = [];
  let askedClarifyingQuestions = false;
  let totalChars = 0;
  let truncated = false;

  for (const record of messages) {
    if (truncated) break;
    const msg = record.message;
    const msgType = msg['type'] as string | undefined;

    if (msgType === 'text-delta') {
      // Streaming text chunk — accumulate for transcript
      const text = msg['text'] as string | undefined;
      if (text) {
        const r = appendLine(lines, `[Text] ${text}`, totalChars);
        totalChars = r.totalChars;
        truncated = r.truncated;
        if (looksLikeQuestion(text)) askedClarifyingQuestions = true;
      }
    } else if (msgType === 'reasoning-delta') {
      const text = msg['text'] as string | undefined;
      if (text) {
        const r = appendLine(lines, `[Thinking] ${text}`, totalChars);
        totalChars = r.totalChars;
        truncated = r.truncated;
      }
    } else if (msgType === 'tool-call') {
      const name = (msg['toolName'] as string) ?? 'unknown_tool';
      const args = truncateStr(JSON.stringify(msg['args'] ?? ''), MAX_TOOL_INPUT_CHARS);
      toolCalls.push(name);
      trackFileAccess(name, msg, filesRead, filesModified);
      const r = appendLine(lines, `[Tool Call] ${name}: ${args}`, totalChars);
      totalChars = r.totalChars;
      truncated = r.truncated;
    } else if (msgType === 'tool-result') {
      const output = truncateStr(String(msg['result'] ?? ''), MAX_TOOL_OUTPUT_CHARS);
      const r = appendLine(lines, `[Tool Result] ${output}`, totalChars);
      totalChars = r.totalChars;
      truncated = r.truncated;
    } else if (msgType === 'step') {
      // AI SDK step format: { text, toolCalls, toolResults, usage }
      const stepText = msg['text'] as string | undefined;
      if (stepText) {
        const r = appendLine(lines, `[Assistant] ${stepText}`, totalChars);
        totalChars = r.totalChars;
        truncated = r.truncated;
        if (looksLikeQuestion(stepText)) askedClarifyingQuestions = true;
      }
      const calls = msg['toolCalls'] as ReadonlyArray<Record<string, unknown>> | undefined;
      if (Array.isArray(calls)) {
        for (const call of calls) {
          if (truncated) break;
          const name = (call['toolName'] as string) ?? 'unknown_tool';
          const input = truncateStr(JSON.stringify(call['args'] ?? ''), MAX_TOOL_INPUT_CHARS);
          toolCalls.push(name);
          trackFileAccess(name, call, filesRead, filesModified);
          const r = appendLine(lines, `[Tool Call] ${name}: ${input}`, totalChars);
          totalChars = r.totalChars;
          truncated = r.truncated;
        }
      }
      const results = msg['toolResults'] as ReadonlyArray<Record<string, unknown>> | undefined;
      if (Array.isArray(results)) {
        for (const tr of results) {
          if (truncated) break;
          const output = truncateStr(String(tr['result'] ?? ''), MAX_TOOL_OUTPUT_CHARS);
          const r = appendLine(lines, `[Tool Result] ${output}`, totalChars);
          totalChars = r.totalChars;
          truncated = r.truncated;
        }
      }
    } else if (msgType === 'assistant') {
      const formatted = formatAssistantMessage(msg);
      if (formatted) {
        const result = appendLine(lines, formatted, totalChars);
        totalChars = result.totalChars;
        truncated = result.truncated;
        if (looksLikeQuestion(formatted)) {
          askedClarifyingQuestions = true;
        }
      }
    } else if (msgType === 'tool_use') {
      const name = (msg['name'] as string) ?? 'unknown_tool';
      const input = truncateStr(JSON.stringify(msg['input'] ?? ''), MAX_TOOL_INPUT_CHARS);
      toolCalls.push(name);
      trackFileAccess(name, msg, filesRead, filesModified);
      const line = `[Tool Call] ${name}: ${input}`;
      const result = appendLine(lines, line, totalChars);
      totalChars = result.totalChars;
      truncated = result.truncated;
    } else if (msgType === 'tool_result') {
      const output = truncateStr(extractToolResultText(msg), MAX_TOOL_OUTPUT_CHARS);
      const isError = msg['is_error'] === true;
      if (isError) {
        commandFailures.push(output);
        detectRetryPattern(toolCalls, retryPatterns);
      }
      const prefix = isError ? '[Tool Error]' : '[Tool Result]';
      const line = `${prefix} ${output}`;
      const result = appendLine(lines, line, totalChars);
      totalChars = result.totalChars;
      truncated = result.truncated;
    } else if (msgType === 'result') {
      const resultText = (msg['result'] as string) ?? '';
      if (resultText) {
        const line = `[Final Result] ${resultText}`;
        const result = appendLine(lines, line, totalChars);
        totalChars = result.totalChars;
        truncated = result.truncated;
      }
    }
  }

  if (truncated) {
    lines.push(TRUNCATED_MARKER);
  }

  return {
    text: lines.join('\n'),
    summary: {
      toolCallSequence: toolCalls,
      filesRead: [...filesRead],
      filesModified: [...filesModified],
      commandFailures,
      retryPatterns,
      askedClarifyingQuestions,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function appendLine(
  lines: string[],
  line: string,
  totalChars: number,
): { totalChars: number; truncated: boolean } {
  const newTotal = totalChars + line.length + 1; // +1 for newline
  if (newTotal > MAX_TRANSCRIPT_CHARS) {
    return { totalChars, truncated: true };
  }
  lines.push(line);
  return { totalChars: newTotal, truncated: false };
}

function formatAssistantMessage(msg: Readonly<Record<string, unknown>>): string | undefined {
  const content = msg['message'] as Record<string, unknown> | undefined;
  if (!content) return undefined;

  const contentBlocks = content['content'] as ReadonlyArray<Record<string, unknown>> | undefined;
  if (!Array.isArray(contentBlocks)) return undefined;

  const textParts: string[] = [];
  for (const block of contentBlocks) {
    if (block['type'] === 'text' && typeof block['text'] === 'string') {
      textParts.push(block['text']);
    }
  }
  return textParts.length > 0 ? `[Assistant] ${textParts.join(' ')}` : undefined;
}

function extractToolResultText(msg: Readonly<Record<string, unknown>>): string {
  const content = msg['content'] as string | ReadonlyArray<Record<string, unknown>> | undefined;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block['type'] === 'text' && typeof block['text'] === 'string') {
        parts.push(block['text']);
      }
    }
    return parts.join(' ');
  }
  return '';
}

function truncateStr(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function looksLikeQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

function trackFileAccess(
  toolName: string,
  msg: Readonly<Record<string, unknown>>,
  filesRead: Set<string>,
  filesModified: Set<string>,
): void {
  // Support both Claude SDK format (msg.input) and AI SDK format (msg.args)
  const input = (msg['input'] ?? msg['args']) as Record<string, unknown> | undefined;
  if (!input) return;
  const filePath = (input['file_path'] ?? input['path'] ?? input['filename']) as string | undefined;
  if (!filePath) return;

  if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
    filesRead.add(filePath);
  } else if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') {
    filesModified.add(filePath);
  }
}

function detectRetryPattern(toolCalls: readonly string[], retryPatterns: string[]): void {
  if (toolCalls.length < 2) return;
  const last = toolCalls[toolCalls.length - 1];
  const prev = toolCalls[toolCalls.length - 2];
  if (last === prev) {
    const pattern = `Repeated ${last} after error`;
    if (!retryPatterns.includes(pattern)) {
      retryPatterns.push(pattern);
    }
  }
}
