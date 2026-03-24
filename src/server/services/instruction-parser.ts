// ---------------------------------------------------------------------------
// Instruction Parser — splits CLAUDE.md / rules content into testable blocks
// ---------------------------------------------------------------------------

/** A single testable instruction block extracted from rules content. */
export interface InstructionBlock {
  readonly source: string;
  readonly text: string;
}

/**
 * Parse rules/CLAUDE.md content into semantic instruction blocks.
 *
 * Splits on:
 * - Markdown headings (# / ## / ### etc.)
 * - Numbered lists (1. / 2. etc.)
 * - Bulleted lists (- / * / + prefixed lines)
 * - Paragraph breaks (double newlines)
 *
 * Each block is trimmed and deduplicated. Empty blocks are discarded.
 */
export function parseInstructions(content: string, source: string): InstructionBlock[] {
  if (!content.trim()) return [];

  const rawBlocks = splitIntoBlocks(content);
  const seen = new Set<string>();
  const blocks: InstructionBlock[] = [];

  for (const raw of rawBlocks) {
    const text = cleanBlock(raw);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    blocks.push({ source, text });
  }

  return blocks;
}

/**
 * Parse multiple sources (e.g. CLAUDE.md files + rule entries) into a
 * combined list of instruction blocks.
 */
export function parseAllInstructions(
  entries: readonly { content: string; source: string }[],
): InstructionBlock[] {
  const allBlocks: InstructionBlock[] = [];
  for (const entry of entries) {
    allBlocks.push(...parseInstructions(entry.content, entry.source));
  }
  return allBlocks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Split content into raw blocks using heading/list/paragraph boundaries. */
function splitIntoBlocks(content: string): string[] {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let currentHeadingContext = '';

  for (const line of lines) {
    const isHeading = /^#{1,6}\s+/.test(line);
    const isListItem = /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
    const isBlankLine = line.trim() === '';

    if (isHeading || (isListItem && current.length > 0) || isBlankLine) {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
    }

    if (!isBlankLine) {
      if (isHeading) {
        const headingText = line.replace(/^#{1,6}\s+/, '').trim();
        if (headingText && !isOnlyFormatting(headingText)) {
          if (isActionableHeading(headingText)) {
            // Actionable headings are testable instructions on their own
            blocks.push(headingText);
            currentHeadingContext = '';
          } else {
            // Non-actionable headings become context for child instructions
            currentHeadingContext = headingText;
          }
        }
      } else {
        // Prepend heading context to child instructions for grouping
        if (currentHeadingContext && current.length === 0) {
          current.push(`[${currentHeadingContext}]`);
        }
        current.push(line);
      }
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

/**
 * Check if heading text contains imperative/actionable language.
 * A heading is actionable if it starts with a verb or contains directive keywords.
 */
function isActionableHeading(text: string): boolean {
  const lower = text.toLowerCase();
  // Contains directive keywords
  if (/\b(must|should|always|never|do not|don't|ensure|require|avoid)\b/i.test(lower)) {
    return true;
  }
  // Starts with an imperative verb (common instruction patterns)
  if (/^(use|run|add|set|create|delete|remove|install|configure|enable|disable|check|verify|test|write|read|update|fix|apply|follow|include|exclude|import|export|call|return|throw|handle|log|format|lint|build|deploy|commit|push|pull|merge|rebase)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/** Clean up a raw block: strip list markers, collapse whitespace. */
function cleanBlock(raw: string): string {
  let text = raw.trim();
  // Remove leading list markers
  text = text.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
  // Collapse internal whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Skip very short blocks (likely formatting artifacts)
  if (text.length < 5) return '';
  return text;
}

/** Check if a string is only formatting characters (dashes, equals, etc.). */
function isOnlyFormatting(text: string): boolean {
  return /^[-=_*#~`]+$/.test(text.trim());
}
