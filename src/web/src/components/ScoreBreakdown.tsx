import { useTranslation } from 'react-i18next';
import type { ScoringDimension } from '../types.js';

interface Props {
  dimensionScores: Record<string, number>;
  dimensions: readonly ScoringDimension[];
}

function barColor(score: number): string {
  if (score >= 7) return 'bg-green-400';
  if (score >= 4) return 'bg-yellow-400';
  return 'bg-error';
}

export function ScoreBreakdown({ dimensionScores, dimensions }: Props): React.JSX.Element {
  const { t } = useTranslation();
  // Build display list: use dimensions if available, otherwise fall back to raw scores
  const entries = dimensions.length > 0
    ? dimensions.map((d) => ({
        name: d.name,
        score: dimensionScores[d.name] ?? 0,
        weight: d.weight,
      }))
    : Object.entries(dimensionScores).map(([name, score]) => ({
        name,
        score,
        weight: 1,
      }));

  if (entries.length === 0) {
    return (
      <div className="text-xs text-on-surface-variant/50">{t('report.noDimensionScores')}</div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.name} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface font-medium">{entry.name}</span>
            <span className="text-on-surface-variant font-mono">
              {entry.score.toFixed(1)}/10
              {entry.weight !== 1 && (
                <span className="text-on-surface-variant/50 ml-1">({entry.weight}x)</span>
              )}
            </span>
          </div>
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(entry.score)}`}
              style={{ width: `${(entry.score / 10) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
