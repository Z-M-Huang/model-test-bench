import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AdvancedValues {
  timeoutSeconds: number;
  thinking: { kind: string; budgetTokens?: number };
  effort: 'none' | 'low' | 'medium' | 'high';
}

interface Props {
  value: AdvancedValues;
  onChange: (value: AdvancedValues) => void;
}

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

export function AdvancedSettings({ value, onChange }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  function patch(partial: Partial<AdvancedValues>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="border border-outline-variant/10 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-container hover:bg-surface-container-high transition-colors"
      >
        <span className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>tune</span>
          {t('advanced.title')}
        </span>
        <span
          className={'material-symbols-outlined text-on-surface-variant transition-transform ' + (open ? 'rotate-180' : '')}
          style={{ fontSize: '1.1rem' }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-surface-container-low/50">
          {/* Timeout */}
          <div>
            <label className={labelCls}>{t('advanced.timeout')}</label>
            <input
              type="number"
              className={inputCls + ' max-w-[160px]'}
              min={1}
              value={value.timeoutSeconds}
              onChange={(e) => patch({ timeoutSeconds: Number(e.target.value) || 300 })}
            />
          </div>

          {/* Thinking */}
          <div>
            <label className={labelCls}>{t('advanced.thinking')}</label>
            <div className="flex flex-wrap gap-3 mt-1">
              {['adaptive', 'enabled', 'disabled'].map((kind) => (
                <label
                  key={kind}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer"
                >
                  <input
                    type="radio"
                    name="thinking-kind"
                    className="text-primary-container focus:ring-primary-container"
                    checked={value.thinking.kind === kind}
                    onChange={() => patch({ thinking: { kind, budgetTokens: kind === 'enabled' ? 10000 : undefined } })}
                  />
                  <span className="capitalize">{kind}</span>
                </label>
              ))}
            </div>
            {value.thinking.kind === 'enabled' && (
              <div className="mt-2">
                <label className={labelCls}>{t('advanced.budgetTokens')}</label>
                <input
                  type="number"
                  className={inputCls + ' max-w-[160px]'}
                  min={1}
                  value={value.thinking.budgetTokens ?? 10000}
                  onChange={(e) =>
                    patch({ thinking: { kind: 'enabled', budgetTokens: Number(e.target.value) || 10000 } })
                  }
                />
              </div>
            )}
          </div>

          {/* Effort */}
          <div>
            <label className={labelCls}>{t('advanced.effort')}</label>
            <div className="flex gap-3 mt-1">
              {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer"
                >
                  <input
                    type="radio"
                    name="effort-level"
                    className="text-primary-container focus:ring-primary-container"
                    checked={value.effort === level}
                    onChange={() => patch({ effort: level })}
                  />
                  <span className="capitalize">{level === 'none' ? 'N/A' : level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
