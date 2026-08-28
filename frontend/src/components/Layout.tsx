import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../../image.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
  { to: '/statements', label: 'Statements', icon: 'document' },
  { to: '/all-transactions', label: 'All Transactions', icon: 'transactions' },
  { to: '/rules', label: 'Rules', icon: 'rules' },
];

function NavIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === 'upload') return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>;
  if (name === 'document') return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
  if (name === 'transactions') return <svg {...common}><path d="M4 7h16M4 12h16M4 17h10" /><circle cx="18" cy="17" r="2" /></svg>;
  return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.5" /></svg>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="finflux-sidebar w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <img src={logo} alt="FinFlux" className="brand-logo" />
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 nav-label">Workspace</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="nav-icon w-5 text-center text-gray-500"><NavIcon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="account-copy mb-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Signed in as</p>
            <p className="text-xs text-gray-500 truncate mt-1">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <span className="nav-label">Sign out</span><span className="account-icon">&gt;</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="finflux-content w-full px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
