import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Provider, Scenario, Run } from '../types.js';
import { RunStatusBar } from '../components/RunStatusBar.js';
import { MessageLog } from '../components/MessageLog.js';
import { useLiveProcess } from '../hooks/useLiveProcess.js';

export function RunPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [sseUrl, setSseUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { messages, elapsedMs, isConnected } = useLiveProcess({
    sseUrl,
    onComplete: (data) => {
      if (data.type === 'runComplete') {
        const completedRun = data.run as Run;
        setRun(completedRun);
        navigate(`/runs/${completedRun.id}`);
      } else if (data.type === 'status') {
        setRun((prev) => prev ? { ...prev, status: data.status as Run['status'] } : prev);
      }
    },
  });

  useEffect(() => {
    Promise.all([api.providers.list(), api.scenarios.list()])
      .then(([s, sc]) => {
        setProviders(s);
        setScenarios(sc);
        if (s.length > 0) setSelectedProvider(s[0].id);
        if (sc.length > 0) setSelectedScenario(sc[0].id);
      })
      .catch(() => setError('Failed to load providers/scenarios'));
  }, []);

  const startRun = useCallback(async () => {
    if (!selectedProvider || !selectedScenario) return;
    setStarting(true);
    setError(null);

    try {
      const newRun = await api.runs.create({
        providerId: selectedProvider,
        scenarioId: selectedScenario,
      });
      setRun(newRun);
      setSseUrl(`/api/runs/${newRun.id}/stream`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  }, [selectedProvider, selectedScenario]);

  const handleAbort = useCallback(() => {
    setSseUrl(null);
    if (run) {
      setRun({ ...run, status: 'cancelled' });
    }
  }, [run]);

  const isRunning = run?.status === 'running' || run?.status === 'pending';

  const selectCls =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container';
  const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">{t('run.title')}</h1>
        <p className="text-on-surface-variant text-sm">{t('run.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error-container/20 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left panel: controls */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          <div>
            <label className={labelCls}>{t('run.apiProvider')}</label>
            <select className={selectCls} value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} disabled={isRunning}>
              {providers.length === 0 && <option value="">{t('run.noProviders')}</option>}
              {providers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('run.scenario')}</label>
            <select className={selectCls} value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)} disabled={isRunning}>
              {scenarios.length === 0 && <option value="">{t('run.noScenarios')}</option>}
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void startRun()}
            disabled={starting || isRunning || !selectedProvider || !selectedScenario}
            className="w-full bg-primary-container text-on-primary-container py-2.5 rounded-full font-bold text-sm hover:bg-primary transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {starting ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1rem' }}>progress_activity</span>
                {t('run.starting')}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>play_arrow</span>
                {t('run.startRun')}
              </>
            )}
          </button>
        </div>

        {/* Right panel: message log */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-container-low rounded-lg border border-outline-variant/5 overflow-hidden">
          {run && (
            <div className="p-3 border-b border-outline-variant/10">
              <RunStatusBar
                runId={run.id}
                status={run.status}
                elapsedMs={isRunning ? elapsedMs : run.durationMs}
                turns={run.numTurns}
                onAbort={isRunning ? handleAbort : undefined}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {!run ? (
              <div className="flex items-center justify-center h-full text-on-surface-variant/50 text-sm">
                {t('run.emptyState')}
              </div>
            ) : (
              <MessageLog messages={messages} loading={isRunning && messages.length === 0} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
