import clsx from 'clsx';

export default function KpiCard({ label, value, unit, trend, trendLabel, critical = false, icon }) {
  const trendColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-error' : 'text-secondary';
  const trendIcon = trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat';

  return (
    <div
      className={clsx(
        'bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-1.5',
        'shadow-card',
        critical && 'ring-1 ring-error/20',
        !critical && 'border-l-2 border-l-[#FFC244]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
        {icon && <span className="material-symbols-outlined text-secondary text-[16px]">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-semibold text-on-surface leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[12px] text-secondary">{unit}</span>}
      </div>
      {trendLabel && (
        <div className={clsx('flex items-center gap-1 text-[11px] font-medium', trendColor)}>
          <span className="material-symbols-outlined text-[14px]">{trendIcon}</span>
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
