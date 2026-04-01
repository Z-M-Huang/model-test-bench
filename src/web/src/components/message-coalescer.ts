// ---------------------------------------------------------------------------
// Coalesce consecutive streaming deltas into single display entries
// ---------------------------------------------------------------------------

import type { SDKMessageRecord } from '../types.js';

/** Types that are structural markers — skip during coalescing. */
const STRUCTURAL_TYPES = new Set([
  'start-step', 'finish-step', 'text-start', 'text-end',
  'reasoning-start', 'reasoning-end',
  'tool-input-start', 'tool-input-end', 'tool-input-delta',
]);

/** Merge consecutive text-delta / reasoning-delta records into single entries. */
export function coalesceMessages(records: readonly SDKMessageRecord[]): SDKMessageRecord[] {
  const result: SDKMessageRecord[] = [];
  let i = 0;

  while (i < records.length) {
    const msg = records[i].message;
    const type = (msg.type as string) ?? '';

    if (STRUCTURAL_TYPES.has(type)) { i++; continue; }

    if (type === 'text-delta' || type === 'reasoning-delta') {
      const parts: string[] = [];
      const ts = records[i].timestamp;
      while (i < records.length) {
        const inner = records[i].message;
        const t = (inner.type as string) ?? '';
        if (STRUCTURAL_TYPES.has(t)) { i++; continue; }
        if (t !== type) break;
        const text = inner.text as string | undefined;
        if (text) parts.push(text);
        i++;
      }
      if (parts.length > 0) {
        result.push({ timestamp: ts, message: { type, text: parts.join('') } });
      }
      continue;
    }

    result.push(records[i]);
    i++;
  }

  return result;
}
