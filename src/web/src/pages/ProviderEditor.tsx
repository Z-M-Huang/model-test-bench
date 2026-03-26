import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import type { ProviderConfig, Provider } from '../types.js';
import { ProviderConfigEditor } from '../components/ProviderConfig.js';
import { AdvancedSettings } from '../components/AdvancedSettings.js';

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

const defaultProvider: ProviderConfig = {
  kind: 'api',
  baseUrl: 'https://api.anthropic.com',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
};

export function ProviderEditor(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<ProviderConfig>(defaultProvider);
  const [advanced, setAdvanced] = useState({
    timeoutSeconds: 300,
    thinking: { kind: 'adaptive' } as { kind: string; budgetTokens?: number },
    effort: 'medium' as 'none' | 'low' | 'medium' | 'high',
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.providers.get(id).then((providerData) => {
      if (cancelled) return;
      setName(providerData.name);
      setDescription(providerData.description);
      setProvider(providerData.provider);
      setAdvanced({
        timeoutSeconds: providerData.timeoutSeconds,
        thinking: providerData.thinking ? { ...providerData.thinking } : { kind: 'adaptive' },
        effort: providerData.effort ?? 'medium',
      });
      setLoading(false);
    }).catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load provider');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Provider> = {
        name,
        description,
        provider,
        timeoutSeconds: advanced.timeoutSeconds,
        thinking: advanced.thinking.kind !== 'adaptive' ? advanced.thinking : undefined,
        effort: advanced.effort,
      };
      if (id) {
        await api.providers.update(id, payload);
      } else {
        await api.providers.create(payload);
      }
      navigate('/providers');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const sectionCls = 'space-y-3';
  const sectionHeadingCls = 'text-sm font-bold text-on-surface flex items-center gap-2';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-on-surface-variant text-sm animate-pulse">Loading provider...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">
          {isNew ? 'New Provider' : 'Edit Provider'}
        </h1>
        <p className="text-on-surface-variant text-sm">
          {isNew ? 'Configure a new test environment.' : `Editing provider ${id}`}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-error-container/20 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Basic Info */}
        <section className={sectionCls}>
          <h2 className={sectionHeadingCls}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span>
            Basic Information
          </h2>
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" className={inputCls} value={name} placeholder="my-provider" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls + ' min-h-[60px] resize-y'} value={description} placeholder="Describe this provider..." onChange={(e) => setDescription(e.target.value)} />
          </div>
        </section>

        {/* Provider */}
        <section className={sectionCls}>
          <h2 className={sectionHeadingCls}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>cloud</span>
            Provider Configuration
          </h2>
          <ProviderConfigEditor value={provider} onChange={setProvider} />
        </section>

        {/* Advanced Settings */}
        <section>
          <AdvancedSettings value={advanced} onChange={setAdvanced} />
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1rem' }}>progress_activity</span>
            )}
            {isNew ? 'Create Provider' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/providers')}
            className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors px-4 py-2.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
