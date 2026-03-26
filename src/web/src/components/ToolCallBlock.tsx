import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  name: string;
  input?: unknown;
  output?: unknown;
}

function truncate(val: unknown, maxLen = 500): string {
  const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

export function ToolCallBlock({ name, input, output }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-outline-variant/10 rounded-md overflow-hidden my-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
      >
        <span className="material-symbols-outlined text-tertiary/60" style={{ fontSize: '0.9rem' }}>
          build
        </span>
        <span className="text-[0.7rem] font-mono font-medium text-tertiary">{name}</span>
        <span
          className={'material-symbols-outlined text-on-surface-variant transition-transform ml-auto ' + (open ? 'rotate-180' : '')}
          style={{ fontSize: '0.9rem' }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-surface-container-low/50">
          {input !== undefined && (
            <div>
              <div className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('toolCallBlock.input')}</div>
              <pre className="text-[0.7rem] text-on-surface-variant/80 font-mono whitespace-pre-wrap break-all">
                {truncate(input)}
              </pre>
            </div>
          )}
          {output !== undefined && (
            <div>
              <div className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('toolCallBlock.output')}</div>
              <pre className="text-[0.7rem] text-on-surface-variant/80 font-mono whitespace-pre-wrap break-all">
                {truncate(output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
