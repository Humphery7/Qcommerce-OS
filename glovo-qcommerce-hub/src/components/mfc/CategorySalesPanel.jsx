import ComparisonBarChart from '../charts/ComparisonBarChart';
import EmptyState from '../ui/EmptyState';

const PALETTE = ['#00A082', '#375aa5', '#FFC244', '#d92d20', '#7c5800', '#8e5cd9', '#2fa4d6', '#ef7f4f', '#4caf7d', '#c2478e'];

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }

export default function CategorySalesPanel({ categories }) {
  if (!categories || categories.length === 0) return <EmptyState message="No category sales data available yet." />;

  const top = [...categories]
    .sort((a, b) => b.delivered7d - a.delivered7d)
    .slice(0, 10)
    .map((c, i) => ({ label: c.categoryLevelOne.length > 20 ? c.categoryLevelOne.substring(0, 18) + '...' : c.categoryLevelOne, value: c.delivered7d, color: PALETTE[i % PALETTE.length], wowGrowth: c.wowGrowthDelivered }));

  return (
    <div className="flex flex-col gap-3">
      <ComparisonBarChart data={top} layout="horizontal" height={260} valueFormatter={formatNumber} />
      <div>
        <div className="grid grid-cols-2 gap-x-4 px-0 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary">
          <span>Category</span>
          <span className="text-right">WoW Growth</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {top.map((c) => {
          const growth = c.wowGrowth; const hasGrowth = growth !== null && growth !== undefined && !Number.isNaN(growth); const isUp = hasGrowth && growth > 0; const isFlat = hasGrowth && growth === 0;
          return (
            <div key={c.label} className="flex items-center gap-2 text-[12px] min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="text-on-surface truncate flex-1">{c.label}</span>
              {hasGrowth ? (<span className={'text-right shrink-0 text-[10px] font-semibold ' + (isFlat ? 'text-secondary' : isUp ? 'text-emerald-600' : 'text-error')}>{isUp ? '+' : ''}{growth.toFixed(1)}%</span>) : <span className="text-right text-[10px] text-secondary shrink-0">&mdash;</span>}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
