import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../../image.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
  { to: '/statements', label: 'Statements', icon: 'document' },
  { to: '/all-transactions', label: 'All Transactions', icon: 'transactions' },
];

function NavIcon({ name }: { name: string }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'dashboard') return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
  if (name === 'analytics') return (
    <svg {...common}>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 4 3 5-6" />
    </svg>
  );
  if (name === 'upload') return (
    <svg {...common}>
      <path d="M12 15V3m0 0l-4 4m4-4l4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
  if (name === 'document') return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
  if (name === 'transactions') return (
    <svg {...common}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="10" cy="18" r="2" fill="currentColor" />
    </svg>
  );
  return null;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex finflux-app-shell bg-[#f2f7f5]">
      {/* Sidebar */}
      <aside className="finflux-sidebar w-64 bg-[#edf6f3] border-r border-[#e0ece7] flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-[#e0ece7]">
          <div className="flex items-center justify-center">
            <img src={logo} alt="FinFlux" className="brand-logo h-16 w-auto object-contain" />
          </div>
        </div>
        <nav className="flex-1 px-4 py-5 space-y-1.5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#86a39a] nav-label">WORKSPACE</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#dcf1ea] text-[#1c4d43] border border-[#c4e8dc] shadow-none'
                    : 'text-[#486b62] hover:bg-[#e4f3ed] hover:text-[#1c4d43] border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`nav-icon w-5 text-center flex items-center justify-center ${isActive ? 'text-[#1c8c77]' : 'text-[#38b293]'}`}>
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-5 border-t border-[#e0ece7]">
          <div className="account-copy mb-3">
            <p className="text-[10px] uppercase tracking-widest text-[#86a39a] font-bold">SIGNED IN AS</p>
            <p className="text-xs text-[#486b62] font-medium truncate mt-1">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs font-semibold text-[#5a867c] hover:text-[#1c4d43] transition-colors"
          >
            <span className="nav-label">Sign out</span>
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

