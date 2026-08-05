import { PRICE_GUARD_ACCENT } from './priceGuardNav';

/** Shared by Supplier Health and Category Health — identical card shape in both. */
export default function HealthScoreCard({ title, subtitle, metricValue, metricLabel = 'Average Margin', healthScore }) {
  const pct = Math.max(0, Math.min(100, healthScore ?? 0));

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col items-center gap-1 text-center shadow-card">
      <h3 className="text-[14px] font-semibold text-on-surface">{title}</h3>
      <p className="text-[11px] text-secondary">{subtitle}</p>
      <p className="text-[26px] font-bold leading-none mt-2" style={{ color: PRICE_GUARD_ACCENT }}>
        {metricValue}
      </p>
      <p className="text-[11px] text-secondary">{metricLabel}</p>
      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden mt-1.5">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PRICE_GUARD_ACCENT }} />
      </div>
      <p className="text-[10px] font-semibold text-secondary uppercase tracking-wide mt-1">
        Health Score: {healthScore ?? '—'}/100
      </p>
    </div>
  );
}
