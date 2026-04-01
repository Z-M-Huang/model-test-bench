import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Scenario, ScenarioCategory } from '../types.js';
import { CategoryBadge } from '../components/CategoryBadge.js';

const categoryIcons: Record<ScenarioCategory, string> = {
  reasoning: 'psychology',
  'instruction-following': 'format_list_bulleted',
  planning: 'event_note',
  'tool-strategy': 'code',
  'error-handling': 'error_outline',
  'ambiguity-handling': 'help_outline',
  'scope-management': 'adjust',
  custom: 'tune',
};

const categoryOrder: ScenarioCategory[] = [
  'reasoning',
  'instruction-following',
  'planning',
  'tool-strategy',
  'error-handling',
  'ambiguity-handling',
  'scope-management',
  'custom',
];

export function ScenarioList(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.scenarios
      .list()
      .then(setScenarios)
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = scenarios.reduce<Record<string, Scenario[]>>((acc, sc) => {
    (acc[sc.category] ??= []).push(sc);
    return acc;
  }, {});

  const presentCategories = categoryOrder.filter((c) => grouped[c]?.length);

  return (
    <div className="bg-surface-container-low min-h-full -m-6 p-6">
      {/* Toolbar */}
      <div className="mb-8 flex items-center justify-end">
        <button
          onClick={() => navigate('/scenarios/new')}
          className="bg-gradient-to-br from-primary-container to-primary hover:opacity-90 text-on-primary-container font-semibold px-5 py-2 rounded-full text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary-container/20"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          {t('scenarios.newScenario')}
        </button>
      </div>

      {loading && (
        <p className="text-center text-on-surface-variant py-12">{t('scenarios.loadingScenarios')}</p>
      )}

      {/* Category Sections */}
      <div className="space-y-12 pb-20">
        {presentCategories.map((cat) => {
          const icon = categoryIcons[cat];
          const items = grouped[cat];
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-6 border-b border-outline-variant/10 pb-2">
                <span className="material-symbols-outlined text-primary text-lg">
                  {icon}
                </span>
                <h2 className="text-sm font-bold tracking-tight text-on-surface">{t(`categories.${cat}`)}</h2>
                <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-outline">
                  {t('scenarios.scenarioCount', { count: items.length })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((sc) => (
                  <div
                    key={sc.id}
                    onClick={() => navigate(`/scenarios/${sc.id}`)}
                    className="bg-surface group hover:bg-surface-container transition-all cursor-pointer p-4 rounded-md relative border border-transparent hover:border-outline-variant/20 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        <CategoryBadge category={sc.category} />
                      </div>
                      <button className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-sm">more_vert</span>
                      </button>
                    </div>
                    <h3 className="font-bold text-xs mb-2 group-hover:text-primary transition-colors">
                      {sc.name}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-mono leading-relaxed mb-4 line-clamp-3 bg-surface-container-lowest p-2 rounded">
                      {sc.prompt
                        ? `"${sc.prompt.slice(0, 160)}${sc.prompt.length > 160 ? '...' : ''}"`
                        : t('scenarios.noPrompt')}
                    </p>
                    {/* Enabled tools summary */}
                    {(sc.enabledTools ?? []).length > 0 && (
                      <div className="text-[10px] text-on-surface-variant mb-3 flex flex-wrap gap-1.5">
                        {(sc.enabledTools ?? []).map((tool) => (
                          <span key={tool} className="px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/10 font-mono">{tool}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-outline uppercase tracking-tighter">
                            {t('scenarios.criteria')}
                          </span>
                          <span className="text-xs font-mono font-bold text-on-surface">
                            {String((sc.criticalRequirements ?? []).length).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-outline uppercase tracking-tighter">
                            {t('scenarios.scoring')}
                          </span>
                          <span className="text-xs font-mono font-bold text-on-surface">
                            {String((sc.scoringDimensions ?? []).length).padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {!loading && scenarios.length === 0 && (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-outline-variant text-4xl mb-4 block">
              schema
            </span>
            <p className="text-on-surface-variant text-sm">{t('scenarios.noScenarios')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
