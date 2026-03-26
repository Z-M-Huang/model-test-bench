import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props<T> {
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
}

export function DynamicList<T>({
  items,
  onAdd,
  onRemove,
  renderItem,
  label,
}: Props<T>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-bold text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-[0.65rem] font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          {t('dynamicList.add')}
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-[0.7rem] text-on-surface-variant/60 italic">{t('dynamicList.noItems')}</p>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 bg-surface-container-lowest rounded group border-l-2 border-primary/20"
        >
          <div className="flex-1 min-w-0">{renderItem(item, i)}</div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="mt-1 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      ))}
    </div>
  );
}
