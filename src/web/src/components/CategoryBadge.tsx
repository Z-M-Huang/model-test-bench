import { useTranslation } from 'react-i18next';
import type { ScenarioCategory } from '../types.js';

const colors: Record<ScenarioCategory, string> = {
  planning: 'bg-primary-container/20 text-primary',
  'instruction-following': 'bg-secondary-container/20 text-secondary',
  reasoning: 'bg-surface-container-high text-tertiary',
  'tool-strategy': 'bg-tertiary-container/20 text-tertiary-fixed-dim',
  'error-handling': 'bg-error-container/20 text-error',
  'ambiguity-handling': 'bg-surface-container-highest text-on-secondary-container',
  'scope-management': 'bg-surface-container-high text-primary-fixed-dim',
  custom: 'bg-surface-container-high text-on-surface-variant',
};

interface Props {
  category: ScenarioCategory;
}

export function CategoryBadge({ category }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const cls = colors[category] ?? colors.custom;
  return (
    <span
      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${cls}`}
    >
      {t(`categories.${category}` as const)}
    </span>
  );
}
