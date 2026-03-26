import { useTranslation } from 'react-i18next';

interface McpServerEntry {
  name: string;
  config: Record<string, unknown>;
}

type ServerType = 'stdio' | 'http' | 'sse';

interface Props {
  items: McpServerEntry[];
  onChange: (items: McpServerEntry[]) => void;
}

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

function getType(config: Record<string, unknown>): ServerType {
  if (config.type === 'http') return 'http';
  if (config.type === 'sse') return 'sse';
  return 'stdio';
}

export function McpServerEditor({ items, onChange }: Props): React.JSX.Element {
  const { t } = useTranslation();
  function updateItem(idx: number, name: string, config: Record<string, unknown>) {
    const next = items.map((item, i) => (i === idx ? { name, config } : item));
    onChange(next);
  }

  function addItem() {
    onChange([...items, { name: '', config: { type: 'stdio', command: '', args: [], env: {} } }]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function changeType(idx: number, item: McpServerEntry, newType: ServerType) {
    if (newType === 'stdio') {
      updateItem(idx, item.name, { type: 'stdio', command: '', args: [], env: {} });
    } else {
      updateItem(idx, item.name, { type: newType, url: '', headers: {} });
    }
  }

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const serverType = getType(item.config);
        return (
          <div key={idx} className="bg-surface-container rounded-md p-4 space-y-3 border border-outline-variant/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className={labelCls}>{t('mcpServerEditor.serverName')}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={item.name}
                  placeholder="my-mcp-server"
                  onChange={(e) => updateItem(idx, e.target.value, item.config)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-error/70 hover:text-error transition-colors p-1 mt-4"
                title="Remove"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
              </button>
            </div>

            <div>
              <label className={labelCls}>{t('mcpServerEditor.type')}</label>
              <select
                className={inputCls + ' max-w-[160px]'}
                value={serverType}
                onChange={(e) => changeType(idx, item, e.target.value as ServerType)}
              >
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>

            {serverType === 'stdio' && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('mcpServerEditor.command')}</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={(item.config.command as string) ?? ''}
                    placeholder="npx"
                    onChange={(e) => updateItem(idx, item.name, { ...item.config, command: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('mcpServerEditor.args')}</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={Array.isArray(item.config.args) ? (item.config.args as string[]).join(', ') : ''}
                    placeholder="-y, @modelcontextprotocol/server-filesystem"
                    onChange={(e) =>
                      updateItem(idx, item.name, {
                        ...item.config,
                        args: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('mcpServerEditor.envVars')}</label>
                  <textarea
                    className={inputCls + ' font-mono min-h-[60px] resize-y'}
                    value={
                      item.config.env && typeof item.config.env === 'object'
                        ? Object.entries(item.config.env as Record<string, string>)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('\n')
                        : ''
                    }
                    placeholder={'NODE_ENV=production\nDEBUG=true'}
                    onChange={(e) => {
                      const env: Record<string, string> = {};
                      for (const line of e.target.value.split('\n')) {
                        const eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                          env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
                        }
                      }
                      updateItem(idx, item.name, { ...item.config, env });
                    }}
                  />
                </div>
              </div>
            )}

            {(serverType === 'http' || serverType === 'sse') && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{t('mcpServerEditor.url')}</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={(item.config.url as string) ?? ''}
                    placeholder="http://localhost:3000/mcp"
                    onChange={(e) => updateItem(idx, item.name, { ...item.config, url: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('mcpServerEditor.headers')}</label>
                  <textarea
                    className={inputCls + ' font-mono min-h-[60px] resize-y'}
                    value={
                      item.config.headers && typeof item.config.headers === 'object'
                        ? Object.entries(item.config.headers as Record<string, string>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join('\n')
                        : ''
                    }
                    placeholder={'Authorization: Bearer token\nContent-Type: application/json'}
                    onChange={(e) => {
                      const headers: Record<string, string> = {};
                      for (const line of e.target.value.split('\n')) {
                        const colonIdx = line.indexOf(':');
                        if (colonIdx > 0) {
                          headers[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
                        }
                      }
                      updateItem(idx, item.name, { ...item.config, headers });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addItem}
        className="w-full py-2 border border-dashed border-outline-variant/30 rounded-md text-xs font-bold text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60 transition-colors flex items-center justify-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
        {t('mcpServerEditor.addMcpServer')}
      </button>
    </div>
  );
}
