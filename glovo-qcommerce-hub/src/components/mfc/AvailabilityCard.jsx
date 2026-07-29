import clsx from 'clsx';

export default function AvailabilityCard({ label, data }) {
  if (!data || !data.hasData) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
        <span className="text-[12px] text-secondary">No data available for this period yet.</span>
      </div>
    );
  }

  const { latestValue, latestLabel, direction, percentChange, prior } = data;
  const trendColor = direction === 'up' ? 'text-emerald-600' : direction === 'down' ? 'text-error' : 'text-secondary';
  const trendIcon = direction === 'up' ? 'trending_up' : direction === 'down' ? 'trending_down' : 'trending_flat';

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
        <span className="text-[11px] text-secondary">{latestLabel}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-semibold text-on-surface leading-none tabular-nums">{(latestValue * 100).toFixed(1)}</span>
        <span className="text-[12px] text-secondary">%</span>
      </div>
      {percentChange !== null && percentChange !== undefined && (
        <div className={clsx('flex items-center gap-1 text-[11px] font-medium', trendColor)}>
          <span className="material-symbols-outlined text-[14px]">{trendIcon}</span>
          <span>
            {percentChange > 0 ? '+' : ''}
            {(percentChange * 100).toFixed(1)}pp
          </span>
        </div>
      )}
      {prior && prior.length > 0 && (
        <div className="text-[11px] text-secondary pt-1.5 border-t border-outline-variant/50 mt-0.5">
          {prior.map((p, i) => (
            <span key={p.label}>
              {i > 0 && ' \u2022 '}
              {p.label} {(p.value * 100).toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
