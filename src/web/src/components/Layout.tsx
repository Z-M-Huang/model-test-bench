import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/providers', icon: 'settings_input_component', label: 'Providers' },
  { to: '/scenarios', icon: 'schema', label: 'Scenarios' },
  { to: '/run', icon: 'play_circle', label: 'New Run' },
  { to: '/history', icon: 'history', label: 'Run History' },
] as const;

export function Layout(): React.JSX.Element {
  const navigate = useNavigate();

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
            <div className="text-sm font-bold text-on-surface tracking-tight">Test Bench</div>
            <div className="text-[0.6rem] text-on-surface-variant">Local Environment</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 mt-2">
          {navItems.map(({ to, icon, label }) => (
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
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom action */}
        <div className="px-4 mt-auto space-y-4">
          <button
            type="button"
            onClick={() => navigate('/scenarios/new')}
            className="w-full bg-surface-container-highest text-on-surface py-2 rounded-md font-bold hover:bg-surface-bright transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              add_box
            </span>
            Create Scenario
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
