import { useTranslation } from 'react-i18next';
import type { RunStatus, EvaluationStatus } from '../types.js';

const config: Record<
  RunStatus | EvaluationStatus,
  { dot: string; text: string }
> = {
  completed: { dot: 'bg-green-400', text: 'text-green-400' },
  running: { dot: 'bg-primary animate-pulse', text: 'text-primary-fixed-dim' },
  failed: { dot: 'bg-error', text: 'text-error' },
  pending: { dot: 'bg-outline', text: 'text-on-surface-variant' },
  cancelled: { dot: 'bg-outline', text: 'text-on-surface-variant' },
};

interface Props {
  status: RunStatus | EvaluationStatus;
}

export function StatusBadge({ status }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const c = config[status] ?? config.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high ${c.text} font-medium`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {t(`status.${status}` as const)}
    </span>
  );
}
