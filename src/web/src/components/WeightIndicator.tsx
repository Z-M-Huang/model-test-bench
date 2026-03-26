import { useTranslation } from 'react-i18next';

interface Props {
  weights: number[];
}

export function WeightIndicator({ weights }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const sum = weights.reduce((a, b) => a + b, 0);
  const rounded = Math.round(sum * 100) / 100;
  const isValid = Math.abs(rounded - 1.0) < 0.01;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
      <span className="text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest">
        {t('weight.weightSum')}
      </span>
      <div className="flex items-center gap-2">
        <div className="w-32 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isValid ? 'bg-primary shadow-[0_0_8px_rgba(147,51,234,0.5)]' : 'bg-error'
            }`}
            style={{ width: `${Math.min(rounded * 100, 100)}%` }}
          />
        </div>
        <span
          className={`font-mono text-xs font-bold ${isValid ? 'text-primary' : 'text-error'}`}
        >
          {rounded.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
