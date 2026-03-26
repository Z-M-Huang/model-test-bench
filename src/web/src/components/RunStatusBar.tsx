import { useTranslation } from 'react-i18next';
import type { RunStatus } from '../types.js';
import { StatusBadge } from './StatusBadge.js';
import { formatDuration } from '../i18n/format.js';

interface Props {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  turns: number;
  onAbort?: () => void;
}

export function RunStatusBar({ runId, status, elapsedMs, turns, onAbort }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 bg-surface-container-low px-4 py-2.5 rounded-md border border-outline-variant/10">
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <span className="font-mono text-on-surface-variant" title="Run ID">
          {runId.slice(0, 8)}
        </span>
        <StatusBadge status={status} />
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>timer</span>
          {formatDuration(elapsedMs)}
        </span>
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>replay</span>
          {t('runStatusBar.turns', { count: turns })}
        </span>
      </div>

      {(status === 'running' || status === 'pending') && onAbort && (
        <button
          type="button"
          onClick={onAbort}
          className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-xs font-bold hover:bg-error transition-colors active:scale-95 flex items-center gap-1"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>stop</span>
          {t('runStatusBar.abort')}
        </button>
      )}
    </div>
  );
}
