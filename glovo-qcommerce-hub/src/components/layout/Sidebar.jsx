import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { WORKSPACE_LIST } from '../../app/workspaces';
import { useAuthStore } from '../../store/useAuthStore';
import ThemeToggle from '../ui/ThemeToggle';

function NavItem({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2 py-1.5 px-3 rounded-md text-[13px] font-medium transition-all duration-100',
          isActive
            ? 'bg-[#FFC244]/10 text-[#FFC244] font-semibold sidebar-active-indicator'
            : 'text-secondary hover:text-on-surface hover:bg-surface-container'
        )
      }
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const isInsideWorkspace = WORKSPACE_LIST.some((w) => location.pathname.startsWith(w.path));
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <aside className="w-[220px] h-screen sticky left-0 top-0 flex flex-col py-4 px-3 gap-1 bg-surface-container-lowest border-r border-outline-variant z-50 shrink-0">
      <div className="flex items-center gap-2.5 px-2 pb-3 mb-3 border-b border-outline-variant/50">
        <div className="w-8 h-8 rounded-lg bg-[#FFC244] flex items-center justify-center text-[#5c4200] font-bold text-sm shrink-0 shadow-sm">
          G
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-on-surface leading-tight truncate">
            QCommerce Hub
          </span>
          <span className="text-[9px] uppercase tracking-[0.1em] text-secondary font-medium">Enterprise Ops</span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
        <NavItem to="/" label="Home" icon="home" end />
        <div className="mt-3">
          <div
            className={clsx(
              'flex items-center gap-2 py-1.5 px-3 rounded-md text-[13px] font-medium',
              isInsideWorkspace ? 'text-on-surface' : 'text-secondary'
            )}
          >
            <span className="material-symbols-outlined text-[18px]">apps</span>
            <span>Workspaces</span>
          </div>
          <div className="flex flex-col gap-0.5 ml-2 pl-2.5 border-l border-outline-variant/50">
            {WORKSPACE_LIST.map((ws) => (
              <NavLink
                key={ws.id}
                to={ws.path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 py-1 px-2.5 rounded-md text-[12px] transition-colors',
                    isActive ? 'text-[#FFC244] font-semibold bg-[#FFC244]/10' : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  )
                }
              >
                <span className="material-symbols-outlined text-[16px]">{ws.icon}</span>
                <span>{ws.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-0.5">
          <NavItem to="/favorites" label="Favorites" icon="star" />
          <NavItem to="/recent" label="Recent" icon="history" />
        </div>
      </nav>

      <div className="pt-3 border-t border-outline-variant/50 flex flex-col gap-1">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-container-low/50">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full border border-outline-variant shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#FFC244]/20 text-[#FFC244] flex items-center justify-center font-semibold text-[10px] shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] font-medium text-on-surface truncate leading-tight">{user.name}</span>
              <span className="text-[10px] text-secondary truncate leading-tight">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (window.electronAuth?.signOut) { await window.electronAuth.signOut(); }
                clearAuth();
              }}
              title="Sign Out"
              className="p-0.5 text-secondary hover:text-error rounded transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[12px] text-secondary">Theme</span>
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="flex items-center gap-2 py-1.5 px-3 text-secondary hover:text-on-surface hover:bg-surface-container rounded-md text-[13px] font-medium transition-colors text-left"
        >
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span>Help</span>
        </button>
      </div>
    </aside>
  );
}
