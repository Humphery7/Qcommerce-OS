import clsx from 'clsx';
import { useThemeStore } from '../../store/useThemeStore';

const OPTIONS = [
  { value: 'light', icon: 'light_mode', label: 'Light' },
  { value: 'system', icon: 'brightness_auto', label: 'Auto' },
  { value: 'dark', icon: 'dark_mode', label: 'Dark' }
];

export default function ThemeToggle({ className }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={clsx(
        'inline-flex items-center bg-surface-container border border-outline-variant rounded-md p-0.5 gap-0.5',
        className
      )}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          title={opt.label}
          onClick={() => setTheme(opt.value)}
          className={clsx(
            'flex items-center justify-center w-5 h-5 rounded transition-all duration-100',
            theme === opt.value
              ? 'bg-[#FFC244] text-[#5c4200] shadow-sm'
              : 'text-secondary hover:text-on-surface'
          )}
        >
          <span className="material-symbols-outlined text-[12px]">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
