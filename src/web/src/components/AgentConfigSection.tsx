import { useTranslation } from 'react-i18next';
import { ClaudeMdEditor } from './ClaudeMdEditor.js';
import { NameContentList } from './NameContentList.js';
import type { NameContentEntry } from './NameContentList.js';
import { SubagentEditor } from './SubagentEditor.js';
import { McpServerEditor } from './McpServerEditor.js';

const labelCls = 'block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5';
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder:text-outline/50';

const ALL_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'NotebookEdit',
];

export interface AgentConfigValues {
  claudeMdFiles: { role: 'project' | 'user'; content: string; loadFromFile?: string }[];
  rules: NameContentEntry[];
  skills: NameContentEntry[];
  subagents: {
    name: string;
    description: string;
    prompt: string;
    loadFromFile?: string;
    disallowedTools?: string[];
    mcpServers?: string[];
    skills?: string[];
    maxTurns?: number;
  }[];
  mcpServers: { name: string; config: Record<string, unknown> }[];
  permissionMode: string;
  maxTurns?: number;
  /** Tools to deny. Stored as deniedTools in the UI; converted to allowedTools for the API. */
  deniedTools: string[];
  /** SDK disallowedTools — completely removes tools from the model's context. */
  disallowedTools: string[];
}

interface Props {
  value: AgentConfigValues;
  onChange: (value: AgentConfigValues) => void;
  readOnly?: boolean;
}

function SectionHead({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <span className="material-symbols-outlined text-lg">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3>
    </div>
  );
}

export function AgentConfigSection({ value, onChange, readOnly }: Props): React.JSX.Element {
  const { t } = useTranslation();
  function patch(partial: Partial<AgentConfigValues>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      {/* CLAUDE.md Files */}
      <div className="bg-surface-container p-5 rounded-lg space-y-4">
        <SectionHead icon="description" title={t('agentConfig.claudeMdFiles')} />
        <p className="text-[0.65rem] text-on-surface-variant -mt-2">
          {t('agentConfig.claudeMdHelp')}
        </p>
        {readOnly ? (
          <div className="text-xs text-on-surface-variant">{t('agentConfig.fileCount', { count: value.claudeMdFiles.length })}</div>
        ) : (
          <ClaudeMdEditor items={value.claudeMdFiles} onChange={(items) => patch({ claudeMdFiles: items })} />
        )}
      </div>

      {/* Rules & Skills side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container p-5 rounded-lg space-y-4">
          <SectionHead icon="gavel" title={t('agentConfig.rules')} />
          {readOnly ? (
            <div className="text-xs text-on-surface-variant">{t('agentConfig.ruleCount', { count: value.rules.length })}</div>
          ) : (
            <NameContentList items={value.rules} onChange={(items) => patch({ rules: items })} label="Rule" namePlaceholder="Rule name" contentPlaceholder="Rule content..." />
          )}
        </div>
        <div className="bg-surface-container p-5 rounded-lg space-y-4">
          <SectionHead icon="build" title={t('agentConfig.skills')} />
          {readOnly ? (
            <div className="text-xs text-on-surface-variant">{t('agentConfig.skillCount', { count: value.skills.length })}</div>
          ) : (
            <NameContentList items={value.skills} onChange={(items) => patch({ skills: items })} label="Skill" namePlaceholder="Skill name" contentPlaceholder="Skill definition..." />
          )}
        </div>
      </div>

      {/* Subagents & MCP Servers side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container p-5 rounded-lg space-y-4">
          <SectionHead icon="smart_toy" title={t('agentConfig.subagents')} />
          {readOnly ? (
            <div className="text-xs text-on-surface-variant">{t('agentConfig.subagentCount', { count: value.subagents.length })}</div>
          ) : (
            <SubagentEditor items={value.subagents} onChange={(items) => patch({ subagents: items })} />
          )}
        </div>
        <div className="bg-surface-container p-5 rounded-lg space-y-4">
          <SectionHead icon="dns" title={t('agentConfig.mcpServers')} />
          {readOnly ? (
            <div className="text-xs text-on-surface-variant">{t('agentConfig.serverCount', { count: value.mcpServers.length })}</div>
          ) : (
            <McpServerEditor items={value.mcpServers} onChange={(items) => patch({ mcpServers: items })} />
          )}
        </div>
      </div>

      {/* Permissions, Max Turns, Denied Tools — single card */}
      <div className="bg-surface-container p-5 rounded-lg space-y-4">
        <SectionHead icon="security" title={t('agentConfig.permissionsLimits')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('agentConfig.permissionMode')}</label>
            <select
              className={inputCls + ' max-w-[200px]'}
              value={value.permissionMode}
              disabled={readOnly}
              onChange={(e) => patch({ permissionMode: e.target.value })}
            >
              <option value="default">{t('permissionMode.default')}</option>
              <option value="acceptEdits">{t('permissionMode.acceptEdits')}</option>
              <option value="plan">{t('permissionMode.plan')}</option>
              <option value="bypassPermissions">{t('permissionMode.bypassPermissions')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('agentConfig.maxTurns')}</label>
            <input
              type="number"
              className={inputCls + ' max-w-[160px]'}
              min={1}
              value={value.maxTurns ?? ''}
              placeholder={t('common.noLimit')}
              readOnly={readOnly}
              onChange={(e) => patch({ maxTurns: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        {/* Denied Tools */}
        <div>
          <label className={labelCls}>{t('agentConfig.deniedTools')}</label>
          <p className="text-[0.6rem] text-on-surface-variant mb-2 -mt-1">
            {t('agentConfig.deniedToolsHelp')}
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TOOLS.map((tool) => {
              const denied = value.deniedTools.includes(tool);
              return (
                <label
                  key={tool}
                  className={
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ' +
                    (denied
                      ? 'bg-error/10 text-error border-error/30 line-through'
                      : 'bg-primary-container/10 text-on-surface border-outline-variant/20 hover:border-outline-variant/40')
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={denied}
                    disabled={readOnly}
                    onChange={() => {
                      const next = denied
                        ? value.deniedTools.filter((t) => t !== tool)
                        : [...value.deniedTools, tool];
                      patch({ deniedTools: next });
                    }}
                  />
                  {denied && <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>block</span>}
                  {tool}
                </label>
              );
            })}
          </div>
        </div>

        {/* Disallowed Tools (SDK blocklist — completely removes from model context) */}
        <div>
          <label className={labelCls}>{t('agentConfig.disallowedTools')}</label>
          <p className="text-[0.6rem] text-on-surface-variant mb-2 -mt-1">
            {t('agentConfig.disallowedToolsHelp')}
          </p>
          <input
            type="text"
            className={inputCls}
            value={value.disallowedTools.join(', ')}
            placeholder="e.g. WebSearch, WebFetch"
            readOnly={readOnly}
            onChange={(e) => {
              const tools = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
              patch({ disallowedTools: tools });
            }}
          />
        </div>
      </div>
    </div>
  );
}
