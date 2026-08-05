import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { PRICE_GUARD_NAV, PRICE_GUARD_ACCENT } from './priceGuardNav';
import { useThemeStore } from '../../../store/useThemeStore';

export default function PriceGuardSidebar() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  return (
    <aside className="w-[230px] h-full flex flex-col py-4 px-3 gap-1 bg-surface-container-lowest border-r border-outline-variant shrink-0 overflow-y-auto no-scrollbar">
      <button
        onClick={() => navigate('/mfc/prices/dashboard')}
        className="flex items-center gap-2 px-2 pb-3 mb-2 border-b border-outline-variant/50 text-left"
      >
        <span className="material-symbols-outlined text-[22px]" style={{ color: PRICE_GUARD_ACCENT, fontVariationSettings: "'FILL' 1" }}>
          shield
        </span>
        <span className="text-[15px] font-bold text-on-surface">Price Guard</span>
      </button>

      <button
        type="button"
        onClick={() => navigate('/mfc')}
        className="flex items-center gap-1.5 py-1.5 px-2 mb-2 rounded-md text-[12px] font-medium text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Exit Tool
      </button>

      <nav className="flex-1 flex flex-col gap-0.5">
        {PRICE_GUARD_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 py-1.5 px-3 rounded-md text-[13px] font-medium transition-all duration-100',
                isActive ? 'font-semibold' : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              )
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: `${PRICE_GUARD_ACCENT}1a`, color: PRICE_GUARD_ACCENT } : {}
            }
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-3 border-t border-outline-variant/50">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md border border-outline-variant text-[13px] font-medium text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
          Dark Mode
        </button>
      </div>
    </aside>
  );
}
