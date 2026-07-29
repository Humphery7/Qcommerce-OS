import { useMemo } from 'react';
import EmptyState from '../ui/EmptyState';

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }
function formatPercent(n) { return `${((n || 0) * 100).toFixed(1)}%`; }

function computeListedEfficient(products, getValue) {
  let listed = 0; let efficient = 0;
  products.forEach((p) => {
    const raw = (getValue(p) || '').trim().toLowerCase();
    if (raw === 'yes' || raw === 'no') { listed += 1; if (raw === 'yes') efficient += 1; }
  });
  return { listed, efficient, efficiency: listed > 0 ? efficient / listed : 0 };
}

const ACCESSORS = {
  weekly: { total: (p) => p.weeklyThresholdMet, losf1: (p) => p.losf1?.weeklyThresholdMet, mnlf1: (p) => p.mnlf1?.weeklyThresholdMet },
  monthly: { total: (p) => p.monthlyThresholdMet, losf1: (p) => p.losf1?.monthlyThresholdMet, mnlf1: (p) => p.mnlf1?.monthlyThresholdMet }
};

function SkuStatCard({ label, stats }) {
  const pct = Math.round(stats.efficiency * 100);
  const barColor = stats.efficiency >= 0.8 ? 'bg-emerald-500' : stats.efficiency >= 0.6 ? 'bg-amber-500' : 'bg-error';

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 flex flex-col gap-2 shadow-card">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-semibold leading-none text-on-surface tabular-nums">{formatPercent(stats.efficiency)}</span>
        <span className="text-[12px] text-secondary">efficient</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-secondary">{formatNumber(stats.efficient)} of {formatNumber(stats.listed)} listed SKUs</p>
    </div>
  );
}

export default function ListedEfficientSkuPanel({ products, period }) {
  const stats = useMemo(() => {
    const rows = products || [];
    const accessors = ACCESSORS[period] || ACCESSORS.weekly;
    return { total: computeListedEfficient(rows, accessors.total), losf1: computeListedEfficient(rows, accessors.losf1), mnlf1: computeListedEfficient(rows, accessors.mnlf1) };
  }, [products, period]);

  if (!products || products.length === 0) return <EmptyState message="No threshold data available yet." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <SkuStatCard label="Total" stats={stats.total} />
      <SkuStatCard label="LOSF1 (Lagos)" stats={stats.losf1} />
      <SkuStatCard label="MNLF1 (Manila)" stats={stats.mnlf1} />
    </div>
  );
}
