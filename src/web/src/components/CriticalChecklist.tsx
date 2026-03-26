import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CriticalPartResult } from '../types.js';

interface Props {
  results: readonly CriticalPartResult[];
}

function CheckItem({ result }: { result: CriticalPartResult }): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-outline-variant/10 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-high/50 transition-colors text-left"
      >
        <span
          className={'material-symbols-outlined ' + (result.met ? 'text-green-400' : 'text-error')}
          style={{ fontSize: '1rem', fontVariationSettings: "'FILL' 1" }}
        >
          {result.met ? 'check_circle' : 'cancel'}
        </span>
        <span className="flex-1 text-xs text-on-surface">{result.requirement}</span>
        <span
          className={'material-symbols-outlined text-on-surface-variant transition-transform ' + (open ? 'rotate-180' : '')}
          style={{ fontSize: '0.9rem' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 bg-surface-container-low/50 border-t border-outline-variant/10">
          <div className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('report.evidence')}</div>
          <div className="text-xs text-on-surface-variant whitespace-pre-wrap">{result.evidence}</div>
        </div>
      )}
    </div>
  );
}

export function CriticalChecklist({ results }: Props): React.JSX.Element {
  const { t } = useTranslation();
  if (results.length === 0) {
    return <div className="text-xs text-on-surface-variant/50">{t('report.noCriticalRequirements')}</div>;
  }

  const passed = results.filter((r) => r.met).length;

  return (
    <div className="space-y-2">
      <div className="text-xs text-on-surface-variant mb-2">
        {t('report.passedCount', { passed, total: results.length })}
      </div>
      {results.map((result, idx) => (
        <CheckItem key={idx} result={result} />
      ))}
    </div>
  );
}
