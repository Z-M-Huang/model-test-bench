import { useTranslation } from 'react-i18next';
import type { SetupComplianceReport } from '../types.js';

interface Props {
  compliance: SetupComplianceReport;
}

export function UsagePanel({ compliance }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const ic = compliance.instructionCompliance;
  const total = ic.followed.length + ic.violated.length + ic.notApplicable.length;

  if (total === 0) {
    return <div className="text-xs text-on-surface-variant/50">{t('report.noUsageData')}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-on-surface-variant">
        {t('report.overallCompliance')}{' '}
        <span className="font-mono font-bold text-on-surface">{(ic.overallCompliance * 100).toFixed(0)}%</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-400/10 rounded-md p-3 text-center">
          <div className="text-lg font-bold font-mono text-green-400">{ic.followed.length}</div>
          <div className="text-[0.6rem] uppercase tracking-wider font-bold text-green-400/70">{t('report.followed')}</div>
        </div>
        <div className="bg-error/10 rounded-md p-3 text-center">
          <div className="text-lg font-bold font-mono text-error">{ic.violated.length}</div>
          <div className="text-[0.6rem] uppercase tracking-wider font-bold text-error/70">{t('report.violated')}</div>
        </div>
        <div className="bg-surface-container-high rounded-md p-3 text-center">
          <div className="text-lg font-bold font-mono text-on-surface-variant">{ic.notApplicable.length}</div>
          <div className="text-[0.6rem] uppercase tracking-wider font-bold text-on-surface-variant/70">{t('report.notApplicable')}</div>
        </div>
      </div>
    </div>
  );
}
