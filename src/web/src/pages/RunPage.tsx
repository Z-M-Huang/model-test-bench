import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, subscribeSSE } from '../api.js';
import type { TestSetup, Scenario, Run, SDKMessageRecord } from '../types.js';
import { RunStatusBar } from '../components/RunStatusBar.js';
import { MessageLog } from '../components/MessageLog.js';

export function RunPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [setups, setSetups] = useState<TestSetup[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedSetup, setSelectedSetup] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [reviewerSetupIds, setReviewerSetupIds] = useState<string[]>([]);
  const [maxEvalRounds, setMaxEvalRounds] = useState(1);
  const [run, setRun] = useState<Run | null>(null);
  const [messages, setMessages] = useState<SDKMessageRecord[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [evalStatus, setEvalStatus] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([api.setups.list(), api.scenarios.list()])
      .then(([s, sc]) => {
        setSetups(s);
        setScenarios(sc);
        if (s.length > 0) setSelectedSetup(s[0].id);
        if (sc.length > 0) setSelectedScenario(sc[0].id);
      })
      .catch(() => setError('Failed to load setups/scenarios'));
  }, []);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function addReviewer() {
    if (setups.length === 0) return;
    // Default to the first setup that isn't already selected
    const available = setups.find((s) => !reviewerSetupIds.includes(s.id));
    setReviewerSetupIds((prev) => [...prev, available?.id ?? setups[0].id]);
  }

  function removeReviewer(idx: number) {
    setReviewerSetupIds((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateReviewer(idx: number, setupId: string) {
    setReviewerSetupIds((prev) => prev.map((id, i) => (i === idx ? setupId : id)));
  }

  const startRun = useCallback(async () => {
    if (!selectedSetup || !selectedScenario) return;
    setStarting(true);
    setError(null);
    setMessages([]);
    setElapsedMs(0);
    setEvaluationId(null);
    setEvalStatus(null);

    try {
      const newRun = await api.runs.create({
        setupId: selectedSetup,
        scenarioId: selectedScenario,
        reviewerSetupIds: reviewerSetupIds.length > 0 ? reviewerSetupIds : undefined,
        maxEvalRounds: reviewerSetupIds.length > 0 ? maxEvalRounds : undefined,
      });
      setRun(newRun);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 500);

      const unsub = subscribeSSE(`/api/runs/${newRun.id}/stream`, {
        onMessage: (event) => {
          try {
            const data = JSON.parse(event.data as string) as Record<string, unknown>;

            // Handle evaluation events
            if (data.evaluationId && typeof data.evaluationId === 'string') {
              setEvaluationId(data.evaluationId as string);
              return;
            }
            if (typeof data === 'string' && ['pending', 'running', 'completed', 'failed'].includes(data as string)) {
              // Could be eval status
            }

            if ('status' in data && 'run' in data) {
              setRun(data.run as Run);
              const status = data.status as string;
              if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                // If no reviewers, close SSE now
                if (reviewerSetupIds.length === 0) {
                  unsub();
                  unsubRef.current = null;
                  if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                  }
                }
              }
            } else {
              setMessages((prev) => [...prev, data as SDKMessageRecord]);
            }
          } catch {
            // Ignore parse errors from SSE
          }
        },
        onError: () => {
          unsub();
          unsubRef.current = null;
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        },
      });
      unsubRef.current = unsub;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  }, [selectedSetup, selectedScenario, reviewerSetupIds, maxEvalRounds]);

  const handleAbort = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (run) {
      setRun({ ...run, status: 'cancelled' });
    }
  }, [run]);

  const isRunning = run?.status === 'running' || run?.status === 'pending';

  const selectCls =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container';
  const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';

  // Build role label for each reviewer
  function reviewerRole(idx: number): string {
    if (reviewerSetupIds.length === 1) return 'Synthesizer';
    return idx < reviewerSetupIds.length - 1
      ? (reviewerSetupIds.length > 2 ? `Evaluator ${idx + 1}` : 'Evaluator')
      : 'Synthesizer';
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">New Run</h1>
        <p className="text-on-surface-variant text-sm">Execute a test scenario against a setup configuration.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error-container/20 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left panel: controls */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Execution Setup */}
          <div>
            <label className={labelCls}>Execution Setup</label>
            <select className={selectCls} value={selectedSetup} onChange={(e) => setSelectedSetup(e.target.value)} disabled={isRunning}>
              {setups.length === 0 && <option value="">No setups available</option>}
              {setups.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Scenario */}
          <div>
            <label className={labelCls}>Scenario</label>
            <select className={selectCls} value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)} disabled={isRunning}>
              {scenarios.length === 0 && <option value="">No scenarios available</option>}
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Reviewer Setups */}
          <div className="bg-surface-container rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls + ' mb-0'}>Reviewer Setups</label>
              <button
                type="button"
                onClick={addReviewer}
                disabled={isRunning || setups.length === 0}
                className="text-xs text-primary hover:text-primary/80 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>add</span>
                Add
              </button>
            </div>
            {reviewerSetupIds.length === 0 ? (
              <p className="text-[0.65rem] text-on-surface-variant/60 italic">
                No reviewers — evaluation will be skipped.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewerSetupIds.map((rid, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={'text-[0.6rem] font-bold uppercase tracking-wider w-20 shrink-0 ' + (idx === reviewerSetupIds.length - 1 ? 'text-primary' : 'text-on-surface-variant')}>
                      {reviewerRole(idx)}
                    </span>
                    <select
                      className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-md px-2 py-1.5 text-xs text-on-surface focus:ring-1 focus:ring-primary-container"
                      value={rid}
                      disabled={isRunning}
                      onChange={(e) => updateReviewer(idx, e.target.value)}
                    >
                      {setups.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeReviewer(idx)}
                      disabled={isRunning}
                      className="text-error/60 hover:text-error transition-colors p-0.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>close</span>
                    </button>
                  </div>
                ))}

                {/* Max Rounds */}
                <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/10">
                  <label className="text-[0.6rem] font-bold uppercase tracking-wider text-on-surface-variant w-20 shrink-0">Max Rounds</label>
                  <input
                    type="range"
                    className="flex-1 accent-primary-container"
                    min={1}
                    max={5}
                    value={maxEvalRounds}
                    disabled={isRunning}
                    onChange={(e) => setMaxEvalRounds(Number(e.target.value))}
                  />
                  <span className="text-xs font-mono text-on-surface w-4 text-center">{maxEvalRounds}</span>
                </div>
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            type="button"
            onClick={() => void startRun()}
            disabled={starting || isRunning || !selectedSetup || !selectedScenario}
            className="w-full bg-primary-container text-on-primary-container py-2.5 rounded-full font-bold text-sm hover:bg-primary transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {starting ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1rem' }}>progress_activity</span>
                Starting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>play_arrow</span>
                Start Run
              </>
            )}
          </button>

          {/* Run summary */}
          {run && !isRunning && (
            <div className="text-xs text-on-surface-variant bg-surface-container rounded-md p-3 space-y-1">
              <div>Status: <span className="font-medium text-on-surface capitalize">{run.status}</span></div>
              <div>Duration: <span className="font-mono">{((run.durationMs ?? 0) / 1000).toFixed(1)}s</span></div>
              <div>Turns: <span className="font-mono">{run.numTurns ?? 0}</span></div>
              <div>Cost: <span className="font-mono">${(run.totalCostUsd ?? 0).toFixed(4)}</span></div>
            </div>
          )}

          {/* Evaluation link */}
          {(evaluationId || run?.evaluationId) && (
            <button
              type="button"
              onClick={() => navigate(`/evaluations/${evaluationId ?? run?.evaluationId}`)}
              className="w-full bg-surface-container border border-primary/20 text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary-container/20 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>analytics</span>
              {evalStatus === 'running' ? 'Evaluation Running...' : evalStatus === 'completed' ? 'View Evaluation Report' : 'View Evaluation'}
            </button>
          )}
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
                costUsd={run.totalCostUsd}
                onAbort={isRunning ? handleAbort : undefined}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {!run ? (
              <div className="flex items-center justify-center h-full text-on-surface-variant/50 text-sm">
                Select a setup and scenario, then click Start Run.
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
