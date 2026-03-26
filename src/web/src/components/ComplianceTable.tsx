import { useTranslation } from 'react-i18next';
import type { InstructionCompliance } from '../types.js';

interface Props {
  compliance: InstructionCompliance;
}

type ComplianceStatus = 'followed' | 'violated' | 'not-applicable';

interface Row {
  instruction: string;
  status: ComplianceStatus;
}

const statusStyles: Record<ComplianceStatus, string> = {
  followed: 'bg-green-400/10 text-green-400',
  violated: 'bg-error/10 text-error',
  'not-applicable': 'bg-surface-container-high text-on-surface-variant',
};

const statusKeys: Record<ComplianceStatus, string> = {
  followed: 'report.followed',
  violated: 'report.violated',
  'not-applicable': 'report.notApplicable',
};

export function ComplianceTable({ compliance }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const rows: Row[] = [
    ...compliance.followed.map((instruction): Row => ({ instruction, status: 'followed' })),
    ...compliance.violated.map((instruction): Row => ({ instruction, status: 'violated' })),
    ...compliance.notApplicable.map((instruction): Row => ({ instruction, status: 'not-applicable' })),
  ];

  if (rows.length === 0) {
    return <div className="text-xs text-on-surface-variant/50">{t('report.noComplianceData')}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-on-surface-variant">
        {t('report.overallCompliance')} <span className="font-mono font-bold text-on-surface">{(compliance.overallCompliance * 100).toFixed(0)}%</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="text-[0.65rem] text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('report.instruction')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-outline-variant/5">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-container-highest/40 transition-colors">
                <td className="px-3 py-2.5 text-on-surface">{row.instruction}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${statusStyles[row.status]}`}>
                    {t(statusKeys[row.status])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
