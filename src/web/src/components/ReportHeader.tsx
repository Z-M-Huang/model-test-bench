import { useTranslation } from 'react-i18next';
import type { EvaluationSynthesis, AnswerComparison } from '../types.js';

interface Props {
  synthesis: EvaluationSynthesis;
  answerComparison: AnswerComparison;
  totalCostUsd: number;
  numRounds: number;
}

export function ReportHeader({ synthesis, answerComparison, totalCostUsd, numRounds }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const score = synthesis.weightedTotal;
  const scoreColor = score >= 7 ? 'text-green-400' : score >= 4 ? 'text-yellow-400' : 'text-error';

  return (
    <div className="space-y-4">
      {/* Score banner */}
      <div className="primary-gradient rounded-lg p-6 flex items-center justify-between">
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-white/60 mb-1">{t('report.overallScore')}</div>
          <div className={`text-5xl font-extrabold font-mono ${scoreColor}`}>
            {score.toFixed(1)}
          </div>
          <div className="text-xs text-white/60 mt-1">
            {t('report.confidence', { value: (synthesis.confidence * 100).toFixed(0) })}
          </div>
        </div>
        <div className="text-right space-y-1">
          {synthesis.dissenting.length > 0 && (
            <div className="text-xs text-yellow-200">
              {t('report.dissentingOpinion', { count: synthesis.dissenting.length })}
            </div>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-low p-4 rounded-md">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.answerMatch')}</div>
          <div className={'text-lg font-bold ' + (answerComparison.matches ? 'text-green-400' : 'text-error')}>
            {answerComparison.matches ? t('common.yes') : t('common.no')}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {t('report.similar', { value: (answerComparison.similarity * 100).toFixed(0) })}
          </div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-md">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.evalCost')}</div>
          <div className="text-lg font-mono font-bold text-on-surface">${totalCostUsd.toFixed(4)}</div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-md">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.rounds')}</div>
          <div className="text-lg font-mono font-bold text-on-surface">{numRounds}</div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-md">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('report.consensus')}</div>
          <div className={'text-lg font-bold ' + (synthesis.dissenting.length === 0 ? 'text-green-400' : 'text-yellow-400')}>
            {synthesis.dissenting.length === 0 ? t('report.reached') : t('report.partial')}
          </div>
        </div>
      </div>
    </div>
  );
}
