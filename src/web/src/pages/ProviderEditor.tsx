import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Provider } from '../types.js';

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

interface FormState {
  name: string;
  description: string;
  providerName: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number | undefined;
  maxTokens: number | undefined;
  topP: number | undefined;
  timeoutSeconds: number;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  providerName: 'anthropic',
  model: '',
  apiKey: '',
  baseUrl: '',
  temperature: undefined,
  maxTokens: undefined,
  topP: undefined,
  timeoutSeconds: 300,
};

export function ProviderEditor(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isNew = !id;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.providers.get(id).then((p) => {
      if (cancelled) return;
      setForm({
        name: p.name,
        description: p.description,
        providerName: p.providerName,
        model: p.model,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl ?? '',
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        topP: p.topP,
        timeoutSeconds: p.timeoutSeconds,
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

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Provider> = {
        name: form.name,
        description: form.description,
        providerName: form.providerName,
        model: form.model,
        apiKey: form.apiKey,
        baseUrl: form.baseUrl || undefined,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        topP: form.topP,
        timeoutSeconds: form.timeoutSeconds,
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
        <div className="text-on-surface-variant text-sm animate-pulse">{t('providerEditor.loadingProvider')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">
          {isNew ? t('providerEditor.newTitle') : t('providerEditor.editTitle')}
        </h1>
        <p className="text-on-surface-variant text-sm">
          {isNew ? t('providerEditor.newSubtitle') : t('providerEditor.editSubtitle', { id })}
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
            {t('providerEditor.basicInfo')}
          </h2>
          <div>
            <label className={labelCls}>{t('common.name')}</label>
            <input type="text" className={inputCls} value={form.name} placeholder="my-provider" onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>{t('common.description')}</label>
            <textarea className={inputCls + ' min-h-[60px] resize-y'} value={form.description} placeholder="Describe this provider..." onChange={(e) => patch({ description: e.target.value })} />
          </div>
        </section>

        {/* Provider Config */}
        <section className={sectionCls}>
          <h2 className={sectionHeadingCls}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>cloud</span>
            {t('providerEditor.providerConfig')}
          </h2>
          <div>
            <label className={labelCls}>{t('providerEditor.providerName')}</label>
            <select className={inputCls} value={form.providerName} onChange={(e) => patch({ providerName: e.target.value })}>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('providerEditor.model')}</label>
            <input type="text" className={inputCls} value={form.model} placeholder="e.g. claude-sonnet-4-20250514" onChange={(e) => patch({ model: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>{t('providerEditor.apiKey')}</label>
            <input type="password" className={inputCls} value={form.apiKey} placeholder="sk-..." onChange={(e) => patch({ apiKey: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>{t('providerEditor.baseUrl')}</label>
            <input type="text" className={inputCls} value={form.baseUrl} placeholder="https://api.anthropic.com (optional)" onChange={(e) => patch({ baseUrl: e.target.value })} />
          </div>
        </section>

        {/* Model Parameters */}
        <section className={sectionCls}>
          <h2 className={sectionHeadingCls}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>tune</span>
            {t('providerEditor.modelParameters')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('providerEditor.temperature')}</label>
              <input type="number" className={inputCls} min={0} max={2} step={0.1} value={form.temperature ?? ''} placeholder="0.0 - 2.0" onChange={(e) => patch({ temperature: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className={labelCls}>{t('providerEditor.maxTokens')}</label>
              <input type="number" className={inputCls} min={1} value={form.maxTokens ?? ''} placeholder="Max output tokens" onChange={(e) => patch({ maxTokens: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className={labelCls}>{t('providerEditor.topP')}</label>
              <input type="number" className={inputCls} min={0} max={1} step={0.05} value={form.topP ?? ''} placeholder="0.0 - 1.0" onChange={(e) => patch({ topP: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className={labelCls}>{t('providerEditor.timeoutSeconds')}</label>
              <input type="number" className={inputCls} min={1} value={form.timeoutSeconds} onChange={(e) => patch({ timeoutSeconds: Number(e.target.value) || 300 })} />
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !form.name.trim()}
            className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1rem' }}>progress_activity</span>
            )}
            {isNew ? t('providerEditor.createProvider') : t('providerEditor.saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/providers')}
            className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors px-4 py-2.5"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
