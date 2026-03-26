import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import type { Scenario, ScenarioCategory, WorkspaceFile, ScoringDimension } from '../types.js';
import { CodeEditor } from '../components/CodeEditor.js';
import { DynamicList } from '../components/DynamicList.js';
import { WeightIndicator } from '../components/WeightIndicator.js';
import { AgentConfigSection } from '../components/AgentConfigSection.js';
import type { AgentConfigValues } from '../components/AgentConfigSection.js';
import type { NameContentEntry } from '../components/NameContentList.js';

const ALL_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'NotebookEdit',
];

const categories: ScenarioCategory[] = [
  'planning', 'instruction-following', 'reasoning', 'tool-strategy',
  'error-handling', 'ambiguity-handling', 'scope-management', 'custom',
];

interface FormState {
  name: string;
  category: ScenarioCategory;
  agentConfig: AgentConfigValues;
  prompt: string;
  workspaceFiles: WorkspaceFile[];
  expectedAnswer: string;
  criticalRequirements: string[];
  gradingGuidelines: string;
  scoringDimensions: ScoringDimension[];
}

const emptyAgentConfig: AgentConfigValues = {
  claudeMdFiles: [],
  rules: [],
  skills: [],
  subagents: [],
  mcpServers: [],
  permissionMode: 'acceptEdits',
  maxTurns: undefined,
  deniedTools: [],
  disallowedTools: [],
};

const emptyForm: FormState = {
  name: '', category: 'reasoning', agentConfig: { ...emptyAgentConfig }, prompt: '', workspaceFiles: [],
  expectedAnswer: '', criticalRequirements: [], gradingGuidelines: '', scoringDimensions: [],
};

/** Convert API allowedTools to UI deniedTools. */
function toDenied(allowedTools: readonly string[] | undefined): string[] {
  if (!allowedTools || allowedTools.length === 0) return [];
  return ALL_TOOLS.filter((t) => !allowedTools.includes(t));
}

/** Convert UI deniedTools to API allowedTools. */
function toAllowed(deniedTools: string[]): string[] | undefined {
  if (deniedTools.length === 0) return undefined;
  return ALL_TOOLS.filter((t) => !deniedTools.includes(t));
}

function SectionHead({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <span className="material-symbols-outlined text-lg">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3>
    </div>
  );
}

const labelCls = 'text-[0.7rem] font-bold text-on-surface-variant uppercase tracking-wider';
const inputCls = 'w-full bg-surface-container-lowest border-none rounded focus:ring-1 focus:ring-primary/40 text-sm text-on-surface placeholder:text-on-surface-variant/30 py-2.5';

export function ScenarioEditor(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const isNew = !id;

  useEffect(() => {
    if (!id) return;
    api.scenarios.get(id).then((sc) => {
      setForm({
        name: sc.name, category: sc.category,
        agentConfig: {
          claudeMdFiles: sc.claudeMdFiles.map((f) => ({ ...f })),
          rules: sc.rules.map((r) => ({ ...r })) as NameContentEntry[],
          skills: sc.skills.map((s) => ({ ...s })) as NameContentEntry[],
          subagents: sc.subagents.map((s) => ({ ...s })),
          mcpServers: sc.mcpServers.map((s) => ({ ...s })),
          permissionMode: sc.permissionMode,
          maxTurns: sc.maxTurns,
          deniedTools: toDenied(sc.allowedTools),
          disallowedTools: sc.disallowedTools ? [...sc.disallowedTools] : [],
        },
        prompt: sc.prompt,
        workspaceFiles: [...sc.workspaceFiles], expectedAnswer: sc.expectedAnswer,
        criticalRequirements: [...sc.criticalRequirements],
        gradingGuidelines: sc.gradingGuidelines, scoringDimensions: [...sc.scoringDimensions],
      });
    }).catch(() => navigate('/scenarios')).finally(() => setLoading(false));
  }, [id, navigate]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { agentConfig, ...rest } = form;
      const payload: Partial<Scenario> = {
        ...rest,
        claudeMdFiles: agentConfig.claudeMdFiles,
        rules: agentConfig.rules,
        skills: agentConfig.skills,
        subagents: agentConfig.subagents,
        mcpServers: agentConfig.mcpServers,
        permissionMode: agentConfig.permissionMode,
        maxTurns: agentConfig.maxTurns,
        allowedTools: toAllowed(agentConfig.deniedTools),
        disallowedTools: agentConfig.disallowedTools.length > 0 ? agentConfig.disallowedTools : undefined,
      };
      if (isNew) {
        const created = await api.scenarios.create(payload);
        navigate(`/scenarios/${created.id}`);
      } else {
        await api.scenarios.update(id!, payload);
      }
    } finally { setSaving(false); }
  }

  function updateWsFile(i: number, patch: Partial<WorkspaceFile>) {
    set('workspaceFiles', form.workspaceFiles.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function updateReq(i: number, v: string) {
    set('criticalRequirements', form.criticalRequirements.map((r, idx) => (idx === i ? v : r)));
  }
  function updateDim(i: number, patch: Partial<ScoringDimension>) {
    set('scoringDimensions', form.scoringDimensions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  if (loading) return <p className="text-on-surface-variant py-12 text-center">{t('scenarioEditor.loadingScenario')}</p>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title bar */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">
            {isNew ? t('scenarioEditor.createTitle') : t('scenarioEditor.editTitle')}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {t('scenarioEditor.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/scenarios')} className="px-6 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors">{t('common.discard')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50">
            {saving ? t('scenarioEditor.saving') : t('scenarioEditor.saveScenario')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column — sticky */}
        <section className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-6">
            {/* Basic Info */}
            <div className="bg-surface-container p-5 rounded-lg space-y-4">
              <SectionHead icon="info" title={t('scenarioEditor.basicInfo')} />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>{t('scenarioEditor.scenarioName')}</label>
                  <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. complex_math_reasoning_01" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>{t('scenarioEditor.category')}</label>
                  <select value={form.category} onChange={(e) => set('category', e.target.value as ScenarioCategory)} className={inputCls}>
                    {categories.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Critical Requirements */}
            <div className="bg-surface-container p-5 rounded-lg space-y-4">
              <SectionHead icon="rule" title={t('scenarioEditor.criticalRequirements')} />
              <DynamicList label="" items={form.criticalRequirements}
                onAdd={() => set('criticalRequirements', [...form.criticalRequirements, ''])}
                onRemove={(i) => set('criticalRequirements', form.criticalRequirements.filter((_, idx) => idx !== i))}
                renderItem={(item, i) => (
                  <input type="text" value={item} onChange={(e) => updateReq(i, e.target.value)} placeholder="Requirement..." className="w-full bg-transparent border-none text-xs text-on-surface p-0 focus:ring-0" />
                )}
              />
            </div>

            {/* Expected Answer */}
            <div className="bg-surface-container p-5 rounded-lg space-y-4">
              <SectionHead icon="verified" title={t('scenarioEditor.expectedAnswer')} />
              <CodeEditor value={form.expectedAnswer} onChange={(v) => set('expectedAnswer', v)} placeholder="Describe the ideal response..." rows={8} />
            </div>

            {/* Grading & Scoring */}
            <div className="bg-surface-container p-5 rounded-lg space-y-4">
              <SectionHead icon="analytics" title={t('scenarioEditor.gradingScoring')} />
              <CodeEditor label={t('scenarioEditor.gradingGuidelines')} value={form.gradingGuidelines} onChange={(v) => set('gradingGuidelines', v)} placeholder="General grading instructions..." rows={4} />
              <DynamicList label={t('scenarioEditor.scoringDimensions')} items={form.scoringDimensions}
                onAdd={() => set('scoringDimensions', [...form.scoringDimensions, { name: '', weight: 0, description: '' }])}
                onRemove={(i) => set('scoringDimensions', form.scoringDimensions.filter((_, idx) => idx !== i))}
                renderItem={(dim, i) => (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <input type="text" value={dim.name} onChange={(e) => updateDim(i, { name: e.target.value })} placeholder="Dimension name" className="bg-transparent border-none text-xs font-bold text-on-surface p-0 focus:ring-0 flex-1" />
                      <div className="flex items-center gap-2 bg-surface-container px-2 py-1 rounded">
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">{t('scenarioEditor.weight')}</span>
                        <input type="number" step="0.1" min="0" max="1" value={dim.weight} onChange={(e) => updateDim(i, { weight: parseFloat(e.target.value) || 0 })} className="bg-transparent border-none text-xs font-mono text-primary p-0 w-10 focus:ring-0 text-center" />
                      </div>
                    </div>
                    <input type="text" value={dim.description} onChange={(e) => updateDim(i, { description: e.target.value })} placeholder="Description of this dimension..." className="w-full bg-transparent border-none text-[0.7rem] text-on-surface-variant italic p-0 focus:ring-0" />
                  </div>
                )}
              />
              <WeightIndicator weights={form.scoringDimensions.map((d) => d.weight)} />
            </div>
          </div>
        </section>

        {/* Right Column — scrolls naturally */}
        <section className="col-span-12 lg:col-span-8 space-y-6">
          {/* Agent Config */}
          <AgentConfigSection value={form.agentConfig} onChange={(v) => set('agentConfig', v)} />

          {/* User Prompt */}
          <div className="bg-surface-container p-5 rounded-lg space-y-4">
            <SectionHead icon="terminal" title={t('scenarioEditor.userPrompt')} />
            <CodeEditor value={form.prompt} onChange={(v) => set('prompt', v)} placeholder="Enter the user test prompt here..." rows={8} />
          </div>

          {/* Workspace Files */}
          <div className="bg-surface-container p-5 rounded-lg space-y-4">
            <SectionHead icon="folder_open" title={t('scenarioEditor.workspaceFiles')} />
            <DynamicList label="" items={form.workspaceFiles}
              onAdd={() => set('workspaceFiles', [...form.workspaceFiles, { path: '', content: '' }])}
              onRemove={(i) => set('workspaceFiles', form.workspaceFiles.filter((_, idx) => idx !== i))}
              renderItem={(file, i) => (
                <div className="space-y-2">
                  <input type="text" value={file.path} onChange={(e) => updateWsFile(i, { path: e.target.value })} placeholder="src/path/to/file.ts" className="w-full bg-surface-container-high border-none rounded text-[10px] font-mono text-on-surface-variant py-1.5 px-2 focus:ring-1 focus:ring-primary/40" />
                  <CodeEditor value={file.content} onChange={(v) => updateWsFile(i, { content: v })} placeholder="File content..." rows={4} />
                </div>
              )}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
