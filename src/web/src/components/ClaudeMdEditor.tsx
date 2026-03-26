import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ClaudeMdEntry {
  role: 'project' | 'user';
  content: string;
  loadFromFile?: string;
}

interface Props {
  items: ClaudeMdEntry[];
  onChange: (items: ClaudeMdEntry[]) => void;
}

type SourceMode = 'inline' | 'file';

const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

function getMode(entry: ClaudeMdEntry | undefined): SourceMode {
  if (!entry) return 'inline';
  return entry.loadFromFile ? 'file' : 'inline';
}

function SlotEditor({
  role,
  entry,
  onUpdate,
  onToggle,
}: {
  role: 'project' | 'user';
  entry: ClaudeMdEntry | undefined;
  onUpdate: (entry: ClaudeMdEntry | undefined) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const enabled = !!entry;
  const [mode, setMode] = useState<SourceMode>(getMode(entry));

  function handleModeChange(newMode: SourceMode) {
    setMode(newMode);
    if (!entry) return;
    if (newMode === 'file') {
      onUpdate({ role, content: '', loadFromFile: entry.loadFromFile ?? '' });
    } else {
      onUpdate({ role, content: entry.content, loadFromFile: undefined });
    }
  }

  return (
    <div className={'rounded-lg border transition-colors ' + (enabled ? 'border-primary/30 bg-surface-container' : 'border-outline-variant/10 bg-surface-container/50')}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary">
            {role === 'project' ? 'folder' : 'person'}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
            {t(`claudeMd.${role}`)} CLAUDE.md
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={'relative inline-flex h-5 w-9 items-center rounded-full transition-colors ' + (enabled ? 'bg-primary' : 'bg-outline-variant/30')}
        >
          <span className={'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ' + (enabled ? 'translate-x-4' : 'translate-x-1')} />
        </button>
      </div>

      {enabled && (
        <div className="px-4 pb-4 space-y-3">
          {/* Source toggle */}
          <div className="flex gap-1 bg-surface-container-high rounded-md p-0.5">
            {(['inline', 'file'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={'flex-1 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider rounded transition-colors ' +
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
              className={inputCls + ' font-mono min-h-[100px] resize-y text-xs'}
              value={entry?.content ?? ''}
              placeholder="# CLAUDE.md content..."
              onChange={(e) => onUpdate({ role, content: e.target.value, loadFromFile: undefined })}
            />
          ) : (
            <input
              type="text"
              className={inputCls + ' font-mono text-xs'}
              value={entry?.loadFromFile ?? ''}
              placeholder="/path/to/CLAUDE.md"
              onChange={(e) => onUpdate({ role, content: '', loadFromFile: e.target.value })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ClaudeMdEditor({ items, onChange }: Props): React.JSX.Element {
  const project = items.find((i) => i.role === 'project');
  const user = items.find((i) => i.role === 'user');

  function handleUpdate(role: 'project' | 'user', entry: ClaudeMdEntry | undefined) {
    const other = items.filter((i) => i.role !== role);
    onChange(entry ? [...other, entry] : other);
  }

  function handleToggle(role: 'project' | 'user', enabled: boolean) {
    if (enabled) {
      handleUpdate(role, { role, content: '' });
    } else {
      handleUpdate(role, undefined);
    }
  }

  return (
    <div className="space-y-3">
      <SlotEditor role="project" entry={project} onUpdate={(e) => handleUpdate('project', e)} onToggle={(on) => handleToggle('project', on)} />
      <SlotEditor role="user" entry={user} onUpdate={(e) => handleUpdate('user', e)} onToggle={(on) => handleToggle('user', on)} />
    </div>
  );
}
