import { useState } from 'react';
import clsx from 'clsx';
import Sparkline from '../mfc/Sparkline';

const DEFAULT_PERIODS = [
  { key: 'daily', label: 'D' },
  { key: 'weekly', label: 'W' },
  { key: 'monthly', label: 'M' },
  { key: 'forecast', label: 'F' }
];

export default function PeriodMetricCard({ label, icon, data, periods = DEFAULT_PERIODS, unit = '%', className }) {
  const [active, setActive] = useState(periods[0].key);
  const current = data[active] || {};
  const hasDelta = current.deltaPct !== undefined && current.deltaPct !== null;

  return (
    <div
      className={clsx(
        'bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-card',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-secondary min-w-0">
          {icon && <span className="material-symbols-outlined text-[14px] shrink-0">{icon}</span>}
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] truncate">{label}</span>
        </div>
        <div className="inline-flex items-center bg-surface-container border border-outline-variant rounded-md p-0.5 shrink-0">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setActive(p.key)}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all',
                active === p.key ? 'bg-accent-container text-on-accent-container shadow-sm' : 'text-secondary hover:text-on-surface'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-[20px] font-semibold text-on-surface leading-none tabular-nums">
            {typeof current.value === 'number' ? current.value.toFixed(1) : current.value}
          </span>
          <span className="text-[12px] text-secondary">{unit}</span>
        </div>
        {current.trend && current.trend.length > 1 && (
          <Sparkline data={current.trend.map((v) => ({ value: v }))} color="var(--accent)" width={56} height={22} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-outline-variant/50 mt-0.5">
        {hasDelta ? (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 text-[10px] font-semibold whitespace-nowrap',
              current.deltaPct === 0 ? 'text-secondary' : current.deltaPct > 0 ? 'text-emerald-600' : 'text-error'
            )}
          >
            {current.deltaPct !== 0 && (
              <span className="material-symbols-outlined text-[12px]">
                {current.deltaPct > 0 ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
            {Math.abs(current.deltaPct).toFixed(1)}pp vs prior {active}
          </span>
        ) : (
          <span />
        )}
        {current.note && <span className="text-[10px] text-secondary truncate">{current.note}</span>}
      </div>
    </div>
  );
}
