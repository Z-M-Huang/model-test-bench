import { useTranslation } from 'react-i18next';

const langs = [
  { code: 'en', label: 'EN', icon: 'language' },
  { code: 'zh-CN', label: '中文', icon: 'translate' },
] as const;

export function LanguageSwitcher(): React.JSX.Element {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'en';

  return (
    <div className="flex gap-1">
      {langs.map(({ code, label, icon }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          className={
            'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 ' +
            (current === code
              ? 'bg-surface-variant text-on-surface'
              : 'text-on-surface-variant opacity-80 hover:opacity-100 hover:bg-surface-variant/50')
          }
        >
          <span className={'material-symbols-outlined ' + (current === code ? 'text-primary-container' : '')} style={{ fontSize: '1.1rem' }}>
            {icon}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
