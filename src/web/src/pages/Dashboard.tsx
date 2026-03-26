import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Provider, Scenario, Run } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatDuration } from '../i18n/format.js';

export function Dashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.providers.list().catch(() => [] as Provider[]),
      api.scenarios.list().catch(() => [] as Scenario[]),
      api.runs.list().catch(() => [] as Run[]),
    ]).then(([s, sc, r]) => {
      setProviders(s);
      setScenarios(sc);
      setRuns(r);
      setLoading(false);
    });
  }, []);

  const recentRuns = runs.slice(0, 5);

  const stats = [
    { label: t('dashboard.totalProviders'), value: providers.length, icon: 'settings_suggest' },
    { label: t('dashboard.totalScenarios'), value: scenarios.length, icon: 'account_tree' },
    { label: t('dashboard.totalRuns'), value: runs.length, icon: 'rocket_launch' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">
          {t('dashboard.title')}
        </h1>
        <p className="text-on-surface-variant text-sm">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between group hover:bg-surface-container transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant text-[0.65rem] font-bold uppercase tracking-widest">
                {s.label}
              </span>
              <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors">
                {s.icon}
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-on-surface">
              {loading ? '--' : s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* New Provider */}
          <div
            onClick={() => navigate('/providers/new')}
            className="relative overflow-hidden group rounded-xl p-6 bg-surface-container-high border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-8xl">
                precision_manufacturing
              </span>
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="bg-primary-container/20 p-2 w-fit rounded-lg mb-4">
                <span className="material-symbols-outlined text-primary">add_circle</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">{t('dashboard.newProvider')}</h3>
              <p className="text-on-surface-variant text-sm mb-6 flex-1">
                {t('dashboard.newProviderDesc')}
              </p>
              <span className="text-primary text-[0.7rem] font-bold flex items-center gap-1">
                {t('dashboard.initializeProvider')}{' '}
                <span className="material-symbols-outlined text-[0.9rem]">arrow_forward</span>
              </span>
            </div>
          </div>

          {/* Start Run */}
          <div
            onClick={() => navigate('/run')}
            className="relative overflow-hidden group rounded-xl p-6 bg-surface-container-highest border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-br from-primary-container/40 to-transparent" />
            <div className="relative z-10 h-full flex flex-col">
              <div className="bg-primary p-2 w-fit rounded-lg mb-4">
                <span className="material-symbols-outlined text-on-primary">play_arrow</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">{t('dashboard.startRun')}</h3>
              <p className="text-on-surface-variant text-sm mb-6 flex-1">
                {t('dashboard.startRunDesc')}
              </p>
              <span className="text-on-surface text-[0.7rem] font-bold flex items-center gap-1">
                {t('dashboard.launchEngine')}{' '}
                <span className="material-symbols-outlined text-[0.9rem]">bolt</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/5">
        <div className="px-6 py-4 flex items-center justify-between bg-surface-container">
          <h2 className="text-sm font-bold text-on-surface">{t('dashboard.recentRuns')}</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-[0.7rem] text-primary font-bold hover:underline"
          >
            {t('dashboard.viewAllHistory')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low text-[0.65rem] text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
              <tr>
                <th className="px-6 py-3 font-semibold">{t('table.status')}</th>
                <th className="px-6 py-3 font-semibold">{t('table.provider')}</th>
                <th className="px-6 py-3 font-semibold">{t('table.scenarioName')}</th>
                <th className="px-6 py-3 font-semibold">{t('table.duration')}</th>
                <th className="px-6 py-3 font-semibold">{t('table.turns')}</th>
                <th className="px-6 py-3 font-semibold text-right">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody className="text-[0.75rem] divide-y divide-outline-variant/5">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && recentRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                    {t('dashboard.noRuns')}
                  </td>
                </tr>
              )}
              {recentRuns.map((run, i) => (
                <tr
                  key={run.id}
                  className={`hover:bg-surface-container-highest/40 transition-colors ${
                    i % 2 === 1 ? 'bg-surface-container-low/30' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-6 py-4 font-mono text-on-surface">
                    {run.providerSnapshot?.name ?? run.providerId}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {run.scenarioSnapshot?.name ?? run.scenarioId}
                  </td>
                  <td className="px-6 py-4 font-mono">{formatDuration(run.durationMs)}</td>
                  <td className="px-6 py-4 font-mono text-center">
                    {String(run.numTurns).padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/runs/${run.id}`)}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
