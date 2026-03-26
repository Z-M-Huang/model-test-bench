import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

export interface NameContentEntry {
  name: string;
  content: string;
  loadFromFile?: string;
}

type SourceMode = 'inline' | 'file';

interface Props {
  items: NameContentEntry[];
  onChange: (items: NameContentEntry[]) => void;
  label: string;
  namePlaceholder: string;
  contentPlaceholder: string;
}

function EntryEditor({
  item,
  contentPlaceholder,
  namePlaceholder,
  onUpdate,
  onRemove,
}: {
  item: NameContentEntry;
  contentPlaceholder: string;
  namePlaceholder: string;
  onUpdate: (patch: Partial<NameContentEntry>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SourceMode>(item.loadFromFile ? 'file' : 'inline');

  function handleModeChange(newMode: SourceMode) {
    setMode(newMode);
    if (newMode === 'file') {
      onUpdate({ content: '', loadFromFile: item.loadFromFile ?? '' });
    } else {
      onUpdate({ content: item.content, loadFromFile: undefined });
    }
  }

  return (
    <div className="bg-surface-container rounded-md p-3 space-y-2.5 border border-outline-variant/10">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className={labelCls}>{t('common.name')}</label>
          <input type="text" className={inputCls} value={item.name} placeholder={namePlaceholder} onChange={(e) => onUpdate({ name: e.target.value })} />
        </div>
        <button type="button" onClick={onRemove} className="text-error/70 hover:text-error transition-colors p-1 mt-4">
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
        </button>
      </div>

      {/* Source toggle */}
      <div className="flex gap-1 bg-surface-container-high rounded-md p-0.5">
        {(['inline', 'file'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className={'flex-1 py-1 text-[0.6rem] font-bold uppercase tracking-wider rounded transition-colors ' +
              (mode === m
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface')}
          >
            {m === 'inline' ? t('claudeMd.inlineContent') : t('claudeMd.fileReference')}
          </button>
        ))}
      </div>

      {mode === 'inline' ? (
        <textarea
          className={inputCls + ' font-mono min-h-[60px] resize-y text-xs'}
          value={item.content}
          placeholder={contentPlaceholder}
          onChange={(e) => onUpdate({ content: e.target.value })}
        />
      ) : (
        <input
          type="text"
          className={inputCls + ' font-mono text-xs'}
          value={item.loadFromFile ?? ''}
          placeholder="/path/to/file.md"
          onChange={(e) => onUpdate({ loadFromFile: e.target.value || undefined })}
        />
      )}
    </div>
  );
}

export function NameContentList({ items, onChange, label, namePlaceholder, contentPlaceholder }: Props): React.JSX.Element {
  function updateItem(idx: number, patch: Partial<NameContentEntry>) {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <EntryEditor
          key={idx}
          item={item}
          namePlaceholder={namePlaceholder}
          contentPlaceholder={contentPlaceholder}
          onUpdate={(patch) => updateItem(idx, patch)}
          onRemove={() => onChange(items.filter((_, i) => i !== idx))}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { name: '', content: '' }])}
        className="w-full py-2 border border-dashed border-outline-variant/30 rounded-md text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60 transition-colors flex items-center justify-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
        {t('common.add')} {label}
      </button>
    </div>
  );
}
