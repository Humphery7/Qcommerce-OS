import clsx from 'clsx';

const variants = {
  primary: 'bg-[#FFC244] text-[#5c4200] hover:brightness-95 active:scale-[0.98] shadow-sm',
  solid: 'bg-accent text-on-accent hover:brightness-110 active:scale-[0.98]',
  secondary: 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container active:scale-[0.98]',
  ghost: 'text-secondary hover:bg-surface-container active:scale-[0.98]',
  danger: 'bg-error text-on-error hover:brightness-95 active:scale-[0.98]'
};

const sizes = {
  sm: 'px-2.5 py-1 text-[12px]',
  md: 'px-3 py-1.5 text-[12px]',
  lg: 'px-4 py-2 text-[13px]'
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
      ) : (
        icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
      {children}
    </button>
  );
}
