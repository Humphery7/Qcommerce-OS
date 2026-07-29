import clsx from 'clsx';
import Sparkline from '../mfc/Sparkline';

function Delta({ label, value, goodDirection = 'up' }) {
  if (value === null || value === undefined) return null;
  const isPositive = value > 0;
  const isFlat = value === 0;
  const isGood = goodDirection === 'up' ? isPositive : !isPositive;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold whitespace-nowrap',
        isFlat ? 'text-secondary' : isGood ? 'text-emerald-600' : 'text-error'
      )}
    >
      {label && <span className="text-secondary font-medium mr-0.5">{label}</span>}
      {!isFlat && (
        <span className="material-symbols-outlined text-[12px] font-semibold">
          {isPositive ? 'arrow_upward' : 'arrow_downward'}
        </span>
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function MetricCard({
  icon,
  label,
  value,
  unit,
  deltas = [],
  trend,
  trendColor = '#FFC244',
  badge,
  footnote,
  className
}) {
  return (
    <div
      className={clsx(
        'bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-2',
        'shadow-card transition-all',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-secondary min-w-0">
          {icon && <span className="material-symbols-outlined text-[14px] shrink-0">{icon}</span>}
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] truncate">{label}</span>
        </div>
        {badge}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[20px] font-semibold text-on-surface leading-none tabular-nums truncate">{value}</span>
          {unit && <span className="text-[12px] text-secondary shrink-0">{unit}</span>}
        </div>
        {trend && trend.length > 1 && (
          <Sparkline data={trend.map((v) => ({ value: v }))} color={trendColor} width={48} height={22} />
        )}
      </div>

      {(deltas.length > 0 || footnote) && (
        <div className="flex items-center gap-3 pt-1.5 border-t border-outline-variant/50 mt-0.5 flex-wrap">
          {deltas.map((d, i) => (
            <Delta key={d.label || i} {...d} />
          ))}
          {footnote && <span className="text-[10px] text-secondary ml-auto truncate">{footnote}</span>}
        </div>
      )}
    </div>
  );
}
