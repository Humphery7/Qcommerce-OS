import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

export default function TopNav({ title, breadcrumb, searchPlaceholder, searchValue, onSearchChange, tabs, actions, accentColor }) {
  const a = accentColor || '#FFC244';
  return (
    <header className="flex flex-col w-full sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant shrink-0">
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 min-h-[48px]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              {breadcrumb && breadcrumb.length > 0 && (
                <div className="flex items-center gap-1 text-[12px] text-secondary mr-1">
                  {breadcrumb.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="material-symbols-outlined text-[12px]">chevron_right</span>}
                      {crumb.to ? (
                        <NavLink to={crumb.to} className="hover:text-on-surface transition-colors">{crumb.label}</NavLink>
                      ) : (
                        <span className={i === breadcrumb.length - 1 ? 'font-medium text-on-surface' : ''}>{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <h1 className="text-[16px] font-semibold text-on-surface truncate leading-tight">{title}</h1>
          </div>
          {searchPlaceholder && (
            <div className="relative w-56 hidden lg:block">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[16px]">search</span>
              <input
                className="w-full bg-surface-container border border-outline-variant rounded-md pl-8 pr-3 py-1.5 text-[12px] focus:outline-none placeholder:text-outline transition-all"
                style={{ boxShadow: `0 0 0 0 ${a}40` }}
                onFocus={(e) => { e.target.style.boxShadow = `0 0 0 2px ${a}40`; }}
                onBlur={(e) => { e.target.style.boxShadow = '0 0 0 0 transparent'; }}
                placeholder={searchPlaceholder}
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
      {tabs && tabs.length > 0 && (
        <nav className="flex gap-0 px-5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'px-3 py-2 text-[12px] font-medium cursor-pointer transition-all duration-100 whitespace-nowrap border-b-2 -mb-[1px]',
                  isActive
                    ? 'font-semibold'
                    : 'text-secondary border-transparent hover:text-on-surface'
                )
              }
              style={({ isActive }) => isActive ? { color: a, borderColor: a } : {}}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
