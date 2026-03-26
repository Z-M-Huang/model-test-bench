import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderConfig as ProviderConfigType, ApiProviderConfig, OAuthProviderConfig } from '../types.js';

type Tab = 'api' | 'oauth';

interface Props {
  value: ProviderConfigType;
  onChange: (config: ProviderConfigType) => void;
}

const defaultApi: ApiProviderConfig = {
  kind: 'api',
  baseUrl: 'https://api.anthropic.com',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
};

const defaultOAuth: OAuthProviderConfig = {
  kind: 'oauth',
  oauthToken: '',
  model: 'claude-sonnet-4-20250514',
};

export function ProviderConfigEditor({ value, onChange }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(value.kind);

  function switchTab(next: Tab) {
    setTab(next);
    if (next === 'api') onChange({ ...defaultApi });
    else onChange({ ...defaultOAuth });
  }

  const inputCls =
    'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';
  const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-1 bg-surface-container rounded-md p-0.5">
        {(['api', 'oauth'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={
              'flex-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ' +
              (tab === t
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-on-surface')
            }
          >
            {t === 'api' ? 'API' : 'OAuth'}
          </button>
        ))}
      </div>

      {tab === 'api' && value.kind === 'api' && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{t('providerConfig.baseUrl')}</label>
            <input
              type="text"
              className={inputCls}
              value={value.baseUrl}
              placeholder="https://api.anthropic.com"
              onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>{t('providerConfig.apiKey')}</label>
            <input
              type="password"
              className={inputCls}
              value={value.apiKey}
              placeholder="sk-ant-..."
              onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>{t('providerConfig.model')}</label>
            <input
              type="text"
              className={inputCls}
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
            />
          </div>
        </div>
      )}

      {tab === 'oauth' && value.kind === 'oauth' && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{t('providerConfig.oauthToken')}</label>
            <input
              type="password"
              className={inputCls}
              value={value.oauthToken}
              placeholder="oauth-token..."
              onChange={(e) => onChange({ ...value, oauthToken: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>{t('providerConfig.model')}</label>
            <input
              type="text"
              className={inputCls}
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
