import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher.js';

const navItems = [
  { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard' },
  { to: '/providers', icon: 'settings_input_component', labelKey: 'nav.providers' },
  { to: '/scenarios', icon: 'schema', labelKey: 'nav.scenarios' },
  { to: '/run', icon: 'play_circle', labelKey: 'nav.newRun' },
  { to: '/history', icon: 'history', labelKey: 'nav.runHistory' },
] as const;

export function Layout(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex h-screen bg-surface text-on-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-full w-64 shrink-0 overflow-hidden bg-surface-container-low py-4 font-body text-xs font-medium border-r border-outline-variant/5">
        {/* Logo */}
        <div className="px-4 mb-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg primary-gradient flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '1rem' }}>
              science
            </span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-on-surface tracking-tight">{t('nav.testBench')}</div>
            <div className="text-[0.6rem] text-on-surface-variant">{t('nav.envLabel')}</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 mt-2">
          {navItems.map(({ to, icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                'mx-2 flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ' +
                (isActive
                  ? 'bg-surface-variant text-on-surface'
                  : 'text-on-surface-variant opacity-80 hover:opacity-100 hover:bg-surface-variant/50')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={
                      'material-symbols-outlined ' +
                      (isActive ? 'text-primary-container' : '')
                    }
                  >
                    {icon}
                  </span>
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-4 mt-auto space-y-3">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => navigate('/scenarios/new')}
            className="w-full bg-surface-container-highest text-on-surface py-2 rounded-md font-bold hover:bg-surface-bright transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              add_box
            </span>
            {t('nav.createScenario')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-surface p-6">
        <Outlet />
      </main>
    </div>
  );
}
