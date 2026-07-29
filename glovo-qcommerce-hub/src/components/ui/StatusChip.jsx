import clsx from 'clsx';

const tones = {
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  neutral: 'bg-[#FFC244]/10 text-[#7c5800] dark:bg-[#FFC244]/10 dark:text-[#FFC244]',
  critical: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  muted: 'bg-surface-container text-secondary'
};

export default function StatusChip({ tone = 'neutral', children, className, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide',
        tones[tone],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
