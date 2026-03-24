import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/setups', label: 'Setups' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/run', label: 'Run' },
  { to: '/history', label: 'History' },
] as const;

export function Layout(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav
        style={{
          width: 220,
          padding: '1rem',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
          Claude Test Bench
        </h2>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'block',
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              textDecoration: 'none',
              color: isActive ? '#1a56db' : '#374151',
              backgroundColor: isActive ? '#eff6ff' : 'transparent',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
