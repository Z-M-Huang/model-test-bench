import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  content: string;
}

export function ThinkingBlock({ content }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-outline-variant/10 rounded-md overflow-hidden my-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
      >
        <span className="material-symbols-outlined text-primary/60" style={{ fontSize: '0.9rem' }}>
          psychology
        </span>
        <span className="text-[0.7rem] font-medium text-on-surface-variant">{t('thinkingBlock.thinking')}</span>
        <span
          className={'material-symbols-outlined text-on-surface-variant transition-transform ml-auto ' + (open ? 'rotate-180' : '')}
          style={{ fontSize: '0.9rem' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 text-xs text-on-surface-variant/70 font-mono whitespace-pre-wrap bg-surface-container-low/50">
          {content}
        </div>
      )}
    </div>
  );
}
