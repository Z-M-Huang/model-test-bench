import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SubagentEntry {
  name: string;
  description: string;
  prompt: string;
  loadFromFile?: string;
  disallowedTools?: string[];
  mcpServers?: string[];
  skills?: string[];
  maxTurns?: number;
}

interface Props {
  items: SubagentEntry[];
  onChange: (items: SubagentEntry[]) => void;
}

type SourceMode = 'inline' | 'file';

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

/** Comma-separated string <-> string[] helpers. */
function csvToArr(csv: string): string[] {
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}
function arrToCsv(arr: readonly string[] | undefined): string {
  return arr?.join(', ') ?? '';
}

function AdvancedSection({
  item,
  onUpdate,
}: {
  item: SubagentEntry;
  onUpdate: (patch: Partial<SubagentEntry>) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasAdvanced = (item.disallowedTools?.length ?? 0) > 0
    || (item.mcpServers?.length ?? 0) > 0
    || (item.skills?.length ?? 0) > 0
    || item.maxTurns !== undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined transition-transform" style={{ fontSize: '0.8rem', transform: open ? 'rotate(90deg)' : undefined }}>chevron_right</span>
        {t('subagentEditor.advanced')}{hasAdvanced ? ' *' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-3 pl-3 border-l-2 border-outline-variant/20">
          <div>
            <label className={labelCls}>Disallowed Tools</label>
            <input type="text" className={inputCls + ' text-xs'} value={arrToCsv(item.disallowedTools)} placeholder="Bash, Write" onChange={(e) => onUpdate({ disallowedTools: csvToArr(e.target.value).length > 0 ? csvToArr(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={labelCls}>MCP Servers</label>
            <input type="text" className={inputCls + ' text-xs'} value={arrToCsv(item.mcpServers)} placeholder="github, slack" onChange={(e) => onUpdate({ mcpServers: csvToArr(e.target.value).length > 0 ? csvToArr(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={labelCls}>Skills</label>
            <input type="text" className={inputCls + ' text-xs'} value={arrToCsv(item.skills)} placeholder="commit, review-pr" onChange={(e) => onUpdate({ skills: csvToArr(e.target.value).length > 0 ? csvToArr(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={labelCls}>Max Turns</label>
            <input type="number" className={inputCls + ' text-xs max-w-[120px]'} min={1} value={item.maxTurns ?? ''} placeholder="No limit" onChange={(e) => onUpdate({ maxTurns: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
      )}
    </div>
  );
}

function EntryEditor({
  item,
  onUpdate,
  onRemove,
}: {
  item: SubagentEntry;
  onUpdate: (patch: Partial<SubagentEntry>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SourceMode>(item.loadFromFile ? 'file' : 'inline');

  function handleModeChange(newMode: SourceMode) {
    setMode(newMode);
    if (newMode === 'file') {
      onUpdate({ prompt: '', loadFromFile: item.loadFromFile ?? '' });
    } else {
      onUpdate({ prompt: item.prompt, loadFromFile: undefined });
    }
  }

  return (
    <div className="bg-surface-container rounded-md p-4 space-y-3 border border-outline-variant/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <label className={labelCls}>{t('common.name')}</label>
          <input type="text" className={inputCls} value={item.name} placeholder="research-agent" onChange={(e) => onUpdate({ name: e.target.value })} />
        </div>
        <button type="button" onClick={onRemove} className="text-error/70 hover:text-error transition-colors p-1 mt-4" title="Remove">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
        </button>
      </div>

      <div>
        <label className={labelCls}>{t('common.description')}</label>
        <input type="text" className={inputCls} value={item.description} placeholder="Handles research and data gathering" onChange={(e) => onUpdate({ description: e.target.value })} />
      </div>

      {/* Source toggle */}
      <div>
        <label className={labelCls}>{t('subagentEditor.promptSource')}</label>
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
              {m === 'inline' ? t('subagentEditor.inlinePrompt') : t('subagentEditor.fileReference')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'inline' ? (
        <textarea
          className={inputCls + ' font-mono min-h-[80px] resize-y text-xs'}
          value={item.prompt}
          placeholder="You are a research assistant..."
          onChange={(e) => onUpdate({ prompt: e.target.value })}
        />
      ) : (
        <input
          type="text"
          className={inputCls + ' font-mono text-xs'}
          value={item.loadFromFile ?? ''}
          placeholder="/path/to/SUBAGENT.md"
          onChange={(e) => onUpdate({ loadFromFile: e.target.value || undefined })}
        />
      )}

      <AdvancedSection item={item} onUpdate={onUpdate} />
    </div>
  );
}

export function SubagentEditor({ items, onChange }: Props): React.JSX.Element {
  const { t } = useTranslation();
  function updateItem(idx: number, patch: Partial<SubagentEntry>) {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <EntryEditor key={idx} item={item} onUpdate={(patch) => updateItem(idx, patch)} onRemove={() => onChange(items.filter((_, i) => i !== idx))} />
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { name: '', description: '', prompt: '' }])}
        className="w-full py-2 border border-dashed border-outline-variant/30 rounded-md text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60 transition-colors flex items-center justify-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
        {t('subagentEditor.addSubagent')}
      </button>
    </div>
  );
}
