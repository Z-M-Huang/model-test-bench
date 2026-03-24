import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import type { TestSetup } from '../types.js';

function maskKey(key: string): string {
  if (key.length <= 6) return '****';
  return '****' + key.slice(-6);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const rowIcons: { icon: string; color: string }[] = [
  { icon: 'terminal', color: 'bg-primary/10 text-primary' },
  { icon: 'code', color: 'bg-tertiary/10 text-tertiary' },
  { icon: 'security', color: 'bg-secondary/10 text-secondary' },
];

export function SetupList(): React.JSX.Element {
  const navigate = useNavigate();
  const [setups, setSetups] = useState<TestSetup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.setups
      .list()
      .then(setSetups)
      .catch(() => setSetups([]))
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    if (!confirm('Delete this setup?')) return;
    api.setups.delete(id).then(() => setSetups((prev) => prev.filter((s) => s.id !== id)));
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[0.7rem] text-tertiary uppercase tracking-tighter">
              Environment
            </span>
            <span className="text-on-surface-variant/30 text-xs">/</span>
            <span className="font-mono text-[0.7rem] text-on-surface uppercase tracking-tighter">
              Setups
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">Test Setups</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure and manage your LLM provider integration parameters.
          </p>
        </div>
        <button
          onClick={() => navigate('/setups/new')}
          className="bg-gradient-to-br from-primary-container to-primary hover:opacity-90 text-on-primary-container font-semibold px-5 py-2 rounded-full text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary-container/20"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Setup
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 font-mono text-[0.65rem] text-on-surface-variant">
        <span className="px-2 py-0.5 rounded bg-surface-container-low hover:bg-secondary-container/20 cursor-pointer transition-colors">
          root
        </span>
        <span className="text-outline-variant">/</span>
        <span className="px-2 py-0.5 rounded bg-surface-container-low hover:bg-secondary-container/20 cursor-pointer transition-colors">
          configs
        </span>
        <span className="text-outline-variant">/</span>
        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface">
          setups_list.json
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest">
                  Name
                </th>
                <th className="px-6 py-4 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest">
                  Provider &amp; Details
                </th>
                <th className="px-6 py-4 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest">
                  Model
                </th>
                <th className="px-6 py-4 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest">
                  Created Date
                </th>
                <th className="px-6 py-4 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && setups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                    No setups yet. Create one to get started.
                  </td>
                </tr>
              )}
              {setups.map((setup, i) => {
                const ri = rowIcons[i % rowIcons.length];
                // The list API returns summary fields (providerType, model) instead of the full provider object.
                const extra = setup as unknown as Record<string, unknown>;
                const providerKind = setup.provider?.kind ?? (extra.providerType as string) ?? 'api';
                const providerModel = setup.provider?.model ?? (extra.model as string) ?? '';
                const isApi = providerKind === 'api';
                const providerLabel = isApi ? 'Anthropic API' : 'Claude Code Auth';
                return (
                  <tr
                    key={setup.id}
                    className={`hover:bg-surface-container-highest/40 transition-colors group ${
                      i % 2 === 1 ? 'bg-surface-container-low/20' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${ri.color}`}>
                          <span className="material-symbols-outlined text-base">{ri.icon}</span>
                        </div>
                        <div>
                          <div className="text-[0.8rem] font-semibold text-on-surface">
                            {setup.name}
                          </div>
                          <div className="text-[0.65rem] text-on-surface-variant font-mono">
                            ID: {setup.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.7rem] px-2 py-0.5 w-fit rounded-full bg-surface-container-high text-tertiary-fixed-dim border border-outline-variant/20 mb-1">
                          {providerLabel}
                        </span>
                        {isApi && setup.provider?.kind === 'api' && (
                          <div className="text-[0.6rem] font-mono text-on-surface-variant flex flex-col">
                            <span>
                              URL:{' '}
                              {new URL(setup.provider.baseUrl).hostname}
                            </span>
                            <span>KEY: {maskKey(setup.provider.apiKey)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[0.75rem] text-on-surface-variant">
                        {providerModel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[0.75rem] text-on-surface-variant">
                      {fmtDate(setup.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/setups/${setup.id}/edit`)}
                          className="p-1.5 hover:bg-surface-bright rounded text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[1.1rem]">edit</span>
                        </button>
                        <button
                          onClick={() =>
                            api.setups
                              .create({ ...setup, name: `${setup.name} (copy)` })
                              .then((copy) => setSetups((prev) => [...prev, copy]))
                          }
                          className="p-1.5 hover:bg-surface-bright rounded text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Duplicate"
                        >
                          <span className="material-symbols-outlined text-[1.1rem]">
                            content_copy
                          </span>
                        </button>
                        <button
                          onClick={() => handleDelete(setup.id)}
                          className="p-1.5 hover:bg-error/10 rounded text-on-surface-variant hover:text-error transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[1.1rem]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
