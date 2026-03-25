import type { RunStatus } from '../types.js';
import { StatusBadge } from './StatusBadge.js';

interface Props {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  turns: number;
  costUsd: number;
  onAbort?: () => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
}

export function RunStatusBar({ runId, status, elapsedMs, turns, costUsd, onAbort }: Props): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 bg-surface-container-low px-4 py-2.5 rounded-md border border-outline-variant/10">
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <span className="font-mono text-on-surface-variant" title="Run ID">
          {runId.slice(0, 8)}
        </span>
        <StatusBadge status={status} />
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>timer</span>
          {formatElapsed(elapsedMs)}
        </span>
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>replay</span>
          {turns} turns
        </span>
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>payments</span>
          ${(costUsd ?? 0).toFixed(4)}
        </span>
      </div>

      {(status === 'running' || status === 'pending') && onAbort && (
        <button
          type="button"
          onClick={onAbort}
          className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-xs font-bold hover:bg-error transition-colors active:scale-95 flex items-center gap-1"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>stop</span>
          Abort
        </button>
      )}
    </div>
  );
}
