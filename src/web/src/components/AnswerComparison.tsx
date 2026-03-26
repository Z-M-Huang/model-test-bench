import { useTranslation } from 'react-i18next';
import type { AnswerComparison as AnswerComparisonType } from '../types.js';

interface Props {
  comparison: AnswerComparisonType;
  expectedAnswer: string;
  actualAnswer: string;
}

export function AnswerComparison({ comparison, expectedAnswer, actualAnswer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const similarityPct = (comparison.similarity * 100).toFixed(0);
  const barColor = comparison.similarity >= 0.7 ? 'bg-green-400' : comparison.similarity >= 0.4 ? 'bg-yellow-400' : 'bg-error';

  return (
    <div className="space-y-4">
      {/* Similarity indicator */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-on-surface-variant font-medium">{t('report.similarity')}</div>
        <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${similarityPct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-on-surface font-bold">{similarityPct}%</span>
      </div>

      {/* Explanation */}
      {comparison.explanation && (
        <div className="text-xs text-on-surface-variant bg-surface-container rounded-md p-3">
          {comparison.explanation}
        </div>
      )}

      {/* Side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.expected')}</div>
          <div className="bg-surface-container rounded-md p-3 text-xs text-on-surface font-mono whitespace-pre-wrap min-h-[80px] border border-outline-variant/10">
            {expectedAnswer || <span className="text-on-surface-variant/50 italic">{t('report.noExpectedAnswer')}</span>}
          </div>
        </div>
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.actual')}</div>
          <div className="bg-surface-container rounded-md p-3 text-xs text-on-surface font-mono whitespace-pre-wrap min-h-[80px] border border-outline-variant/10">
            {actualAnswer || <span className="text-on-surface-variant/50 italic">{t('report.noResultText')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
