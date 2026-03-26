import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import type { Run, RunStatus, Provider, Scenario, Evaluation } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RunHistory(): React.JSX.Element {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProvider, setFilterProvider] = useState('');
  const [filterScenario, setFilterScenario] = useState('');
  const [filterStatus, setFilterStatus] = useState<RunStatus | ''>('');

  // Eval panel state
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEvals, setSelectedEvals] = useState<Evaluation[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    Promise.all([api.runs.list(), api.providers.list(), api.scenarios.list()])
      .then(([r, s, sc]) => {
        setRuns(r);
        setProviders(s);
        setScenarios(sc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const providerMap = new Map(providers.map((s) => [s.id, s.name]));
  const scenarioMap = new Map(scenarios.map((s) => [s.id, s.name]));

  const filtered = runs.filter((r) => {
    if (filterProvider && r.providerId !== filterProvider) return false;
    if (filterScenario && r.scenarioId !== filterScenario) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) ?? null : null;

  const handleRowClick = useCallback((run: Run) => {
    if (selectedRunId === run.id) {
      setSelectedRunId(null);
      return;
    }
    setSelectedRunId(run.id);
    setSelectedEvals([]);
    setLoadingEvals(true);
    const id = ++fetchIdRef.current;
    api.evaluations.list({ runId: run.id })
      .then((evals) => {
        if (id !== fetchIdRef.current) return;
        setSelectedEvals(evals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return;
        setSelectedEvals([]);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoadingEvals(false);
      });
  }, [selectedRunId]);

  const selectCls =
    'bg-surface-container-low border border-outline-variant/20 rounded-md px-2 py-1 text-xs text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container';

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">Run History</h1>
        <p className="text-on-surface-variant text-sm">Browse and filter all previous test runs.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className={selectCls} value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
          <option value="">All Providers</option>
          {providers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={selectCls} value={filterScenario} onChange={(e) => setFilterScenario(e.target.value)}>
          <option value="">All Scenarios</option>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={selectCls} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as RunStatus | '')}>
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Split panel: table + eval sidebar */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Table */}
        <div className="flex-1 min-w-0 bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/5">
          <div className="overflow-x-auto h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container text-[0.65rem] text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Scenario</th>
                  <th className="px-6 py-3 font-semibold">Provider</th>
                  <th className="px-6 py-3 font-semibold">Duration</th>
                  <th className="px-6 py-3 font-semibold text-center">Turns</th>
                  <th className="px-6 py-3 font-semibold text-right">Cost</th>
                  <th className="px-6 py-3 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="text-[0.75rem] divide-y divide-outline-variant/5">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant animate-pulse">
                      Loading runs...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant/50">
                      No runs found.
                    </td>
                  </tr>
                )}
                {filtered.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => handleRowClick(run)}
                    className={
                      'hover:bg-surface-container-highest/40 transition-colors cursor-pointer' +
                      (selectedRunId === run.id ? ' bg-primary-container/10 ring-1 ring-inset ring-primary-container/30' : '')
                    }
                  >
                    <td className="px-6 py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {scenarioMap.get(run.scenarioId) ?? run.scenarioId.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 font-mono text-on-surface">
                      {providerMap.get(run.providerId) ?? run.providerId.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-6 py-4 font-mono text-center">
                      {run.numTurns}
                    </td>
                    <td className="px-6 py-4 font-mono text-right">
                      ${run.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant text-right">
                      {formatDate(run.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Eval sidebar panel */}
        <div className={'transition-all duration-300 overflow-hidden flex-shrink-0 ' + (selectedRunId ? 'w-96' : 'w-0')}>
          {selectedRun && (
            <div className="w-96 h-full overflow-y-auto border-l border-outline-variant/10 bg-surface-container-low">
              {/* Panel header */}
              <div className="sticky top-0 bg-surface-container px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-on-surface truncate">
                    {scenarioMap.get(selectedRun.scenarioId) ?? selectedRun.scenarioId.slice(0, 8)}
                  </div>
                  <div className="text-[0.65rem] text-on-surface-variant font-mono truncate">
                    {providerMap.get(selectedRun.providerId) ?? selectedRun.providerId.slice(0, 8)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <StatusBadge status={selectedRun.status} />
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(null)}
                    className="text-on-surface-variant/60 hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-4 py-3 flex gap-2 border-b border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => navigate(`/runs/${selectedRun.id}`)}
                  className="flex-1 bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-bold py-2 rounded-md transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>visibility</span>
                  View Run
                </button>
                {selectedRun.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/runs/${selectedRun.id}/evaluate`)}
                    className="flex-1 bg-primary-container/20 hover:bg-primary-container/30 text-primary text-xs font-bold py-2 rounded-md transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>rate_review</span>
                    New Eval
                  </button>
                )}
              </div>

              {/* Evaluation list */}
              <div className="px-4 py-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Evaluations
                </div>
                {loadingEvals && (
                  <div className="text-xs text-on-surface-variant/60 animate-pulse py-4 text-center">Loading...</div>
                )}
                {!loadingEvals && selectedEvals.length === 0 && (
                  <div className="text-xs text-on-surface-variant/50 py-4 text-center italic">No evaluations yet.</div>
                )}
                <div className="space-y-2">
                  {selectedEvals.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => navigate(`/evaluations/${ev.id}`)}
                      className="w-full text-left bg-surface-container hover:bg-surface-container-highest rounded-md p-3 border border-outline-variant/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={ev.status} />
                        {ev.status === 'completed' && (
                          <span className="text-sm font-bold font-mono text-on-surface">
                            {ev.synthesis.weightedTotal.toFixed(1)}<span className="text-on-surface-variant/60 text-xs">/10</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[0.65rem] text-on-surface-variant">
                        <span className="font-mono truncate">
                          {ev.evaluators.map((e) => e.role).join(', ')}
                        </span>
                        <span className="ml-2 flex-shrink-0">{formatDate(ev.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
