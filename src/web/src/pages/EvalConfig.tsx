import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Run } from '../types.js';

/** Summary shape returned by the providers list endpoint (no full provider). */
interface ProviderSummary {
  id: string;
  name: string;
  providerType: string;
  model: string;
}

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';
const selectCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container';

interface EvalEntry {
  providerId: string;
  role: string;
}

export function EvalConfig(): React.JSX.Element {
  const { id: runId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [run, setRun] = useState<Run | null>(null);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [evaluators, setEvaluators] = useState<EvalEntry[]>([]);
  const [maxRounds, setMaxRounds] = useState(3);

  useEffect(() => {
    if (!runId) return;
    Promise.all([api.runs.get(runId), api.providers.list()])
      .then(([r, s]) => {
        setRun(r);
        setProviders(s);
        if (s.length > 0) {
          setEvaluators([{ providerId: s[0].id, role: 'Synthesizer' }]);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [runId]);

  function updateEvaluator(idx: number, patch: Partial<EvalEntry>) {
    setEvaluators((prev) =>
      prev.map((e, i) => {
        const updated = i === idx ? { ...e, ...patch } : e;
        if (i === prev.length - 1 && updated.role !== 'Synthesizer') {
          return { ...updated, role: 'Synthesizer' };
        }
        return updated;
      }),
    );
  }

  function addEvaluator() {
    if (providers.length === 0) return;
    setEvaluators((prev) => {
      const updated = prev.map((e, i) =>
        i === prev.length - 1 ? { ...e, role: prev.length > 1 ? `Evaluator ${prev.length}` : 'Evaluator' } : e,
      );
      return [...updated, { providerId: providers[0].id, role: 'Synthesizer' }];
    });
  }

  function removeEvaluator(idx: number) {
    if (evaluators.length <= 1) return;
    setEvaluators((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((e, i) =>
        i === next.length - 1 ? { ...e, role: 'Synthesizer' } : e,
      );
    });
  }

  async function handleStart() {
    if (!runId) return;
    setStarting(true);
    setError(null);
    try {
      const evaluation = await api.evaluations.create({
        runId,
        evaluators,
        maxRounds,
      });
      navigate(`/evaluations/${evaluation.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start evaluation');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-on-surface-variant text-sm animate-pulse">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-on-surface-variant text-xs font-mono">
          <button type="button" onClick={() => navigate(`/runs/${runId}`)} className="hover:text-on-surface transition-colors">
            Run {runId?.slice(0, 8)}
          </button>
          <span>/</span>
          <span>{t('evalConfig.evaluate')}</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">{t('evalConfig.title')}</h1>
        <p className="text-on-surface-variant text-sm">
          {t('evalConfig.subtitle', { name: run?.scenarioSnapshot?.name ?? '' })}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error-container/20 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="bg-surface-container rounded-md p-6 text-center text-on-surface-variant text-sm">
          {t('evalConfig.noProviders')}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Evaluator list */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>groups</span>
              {t('evalConfig.evaluators')}
            </h2>
            {evaluators.map((entry, idx) => {
              const isLast = idx === evaluators.length - 1;
              return (
                <div key={idx} className="bg-surface-container rounded-md p-4 space-y-3 border border-outline-variant/10">
                  <div className="flex items-center justify-between">
                    <span className={'text-xs font-bold uppercase tracking-wider ' + (isLast ? 'text-primary' : 'text-on-surface-variant')}>
                      {entry.role}
                      {isLast && <span className="ml-1 text-[0.6rem] normal-case font-normal">{t('evalConfig.finalArbiter')}</span>}
                    </span>
                    {evaluators.length > 1 && (
                      <button type="button" onClick={() => removeEvaluator(idx)} className="text-error/70 hover:text-error transition-colors p-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                      </button>
                    )}
                  </div>
                  {!isLast && (
                    <div>
                      <label className={labelCls}>{t('evalConfig.roleName')}</label>
                      <input type="text" className={inputCls + ' max-w-[240px]'} value={entry.role} onChange={(e) => updateEvaluator(idx, { role: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>{t('evalConfig.provider')}</label>
                    <select className={selectCls} value={entry.providerId} onChange={(e) => updateEvaluator(idx, { providerId: e.target.value })}>
                      {providers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.model})</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addEvaluator}
              className="w-full py-2 border border-dashed border-outline-variant/30 rounded-md text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
              {t('evalConfig.addEvaluator')}
            </button>
          </section>

          {/* Settings */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>settings</span>
              {t('evalConfig.settings')}
            </h2>
            <div>
              <label className={labelCls}>{t('evalConfig.maxDebateRounds')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  className="flex-1 accent-primary-container max-w-[200px]"
                  min={1}
                  max={5}
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Number(e.target.value))}
                />
                <span className="text-sm font-mono text-on-surface w-4 text-center">{maxRounds}</span>
              </div>
            </div>

            <div className="text-xs text-on-surface-variant bg-surface-container rounded-md p-3">
              <span className="material-symbols-outlined text-primary/60 mr-1" style={{ fontSize: '0.9rem', verticalAlign: 'middle' }}>
                info
              </span>
              {t('evalConfig.apiCallInfo', { evaluators: evaluators.length, rounds: maxRounds, total: evaluators.length * maxRounds })}
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={starting || evaluators.length === 0}
              className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {starting && (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1rem' }}>progress_activity</span>
              )}
              {t('evalConfig.startEvaluation')}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/runs/${runId}`)}
              className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors px-4 py-2.5"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
