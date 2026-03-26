import { useTranslation } from 'react-i18next';
import type { SetupComplianceReport } from '../types.js';

interface Props {
  compliance: SetupComplianceReport;
}

export function UsagePanel({ compliance }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { skillUsage, subagentUsage } = compliance;
  const hasSkills = skillUsage.length > 0;
  const hasSubagents = subagentUsage.length > 0;

  if (!hasSkills && !hasSubagents) {
    return <div className="text-xs text-on-surface-variant/50">{t('report.noUsageData')}</div>;
  }

  return (
    <div className="space-y-4">
      {hasSkills && (
        <div>
          <h3 className="text-xs font-bold text-on-surface mb-2">{t('report.skillUsage')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[0.65rem] text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('report.skill')}</th>
                  <th className="px-3 py-2 font-semibold text-center">{t('report.invoked')}</th>
                  <th className="px-3 py-2 font-semibold text-right">{t('report.count')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant/5">
                {skillUsage.map((skill) => (
                  <tr key={skill.skillName} className="hover:bg-surface-container-highest/40 transition-colors">
                    <td className="px-3 py-2 text-on-surface font-mono">{skill.skillName}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={'material-symbols-outlined ' + (skill.invoked ? 'text-green-400' : 'text-on-surface-variant/30')}
                        style={{ fontSize: '0.9rem', fontVariationSettings: "'FILL' 1" }}
                      >
                        {skill.invoked ? 'check_circle' : 'cancel'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-on-surface">{skill.invocationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasSubagents && (
        <div>
          <h3 className="text-xs font-bold text-on-surface mb-2">{t('report.subagentUsage')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[0.65rem] text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('report.subagent')}</th>
                  <th className="px-3 py-2 font-semibold text-center">{t('report.invoked')}</th>
                  <th className="px-3 py-2 font-semibold text-right">{t('report.count')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant/5">
                {subagentUsage.map((agent) => (
                  <tr key={agent.subagentName} className="hover:bg-surface-container-highest/40 transition-colors">
                    <td className="px-3 py-2 text-on-surface font-mono">{agent.subagentName}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={'material-symbols-outlined ' + (agent.invoked ? 'text-green-400' : 'text-on-surface-variant/30')}
                        style={{ fontSize: '0.9rem', fontVariationSettings: "'FILL' 1" }}
                      >
                        {agent.invoked ? 'check_circle' : 'cancel'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-on-surface">{agent.invocationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
