import { useTranslation } from 'react-i18next';

interface Props {
  strengths: readonly string[];
  weaknesses: readonly string[];
  recommendations?: readonly string[];
}

export function StrengthsWeaknesses({ strengths, weaknesses, recommendations }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Strengths */}
      <div className="bg-green-400/5 border border-green-400/10 rounded-md p-4">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>thumb_up</span>
          {t('report.strengths')}
        </h3>
        {strengths.length === 0 ? (
          <div className="text-xs text-on-surface-variant/50">{t('report.noneIdentified')}</div>
        ) : (
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                <span className="text-green-400 mt-0.5">&#8226;</span>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Weaknesses */}
      <div className="bg-error/5 border border-error/10 rounded-md p-4">
        <h3 className="text-xs font-bold text-error uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>thumb_down</span>
          {t('report.weaknesses')}
        </h3>
        {weaknesses.length === 0 ? (
          <div className="text-xs text-on-surface-variant/50">{t('report.noneIdentified')}</div>
        ) : (
          <ul className="space-y-1.5">
            {weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                <span className="text-error mt-0.5">&#8226;</span>
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recommendations (full width) */}
      {recommendations && recommendations.length > 0 && (
        <div className="md:col-span-2 bg-primary-container/5 border border-primary-container/10 rounded-md p-4">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>lightbulb</span>
            {t('report.recommendations')}
          </h3>
          <ul className="space-y-1.5">
            {recommendations.map((r, i) => (
              <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&#8226;</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
