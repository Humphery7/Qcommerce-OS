import ComparisonBarChart from '../charts/ComparisonBarChart';
import EmptyState from '../ui/EmptyState';

const PALETTE = ['#00A082', '#375aa5', '#FFC244', '#d92d20', '#7c5800', '#8e5cd9', '#2fa4d6', '#ef7f4f', '#4caf7d', '#c2478e'];

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }

// categories/products from MfcAnalyticsService carry overall figures at the
// top level plus a losf1/mnlf1 sub-object each with the same shape - this
// just picks which one a panel reads from based on the selected store.
function getMetrics(row, store) {
  if (store === 'losf1' || store === 'mnlf1') {
    const s = row[store] || {};
    return { delivered: s.delivered || 0, wowGrowth: s.wowGrowth };
  }
  return { delivered: row.delivered7d, wowGrowth: row.wowGrowthDelivered };
}

export default function CategorySalesPanel({ categories, store = 'overall' }) {
  if (!categories || categories.length === 0) return <EmptyState message="No category sales data available yet." />;

  const top = [...categories]
    .map((c) => ({ raw: c, ...getMetrics(c, store) }))
    .sort((a, b) => b.delivered - a.delivered)
    .slice(0, 10)
    .map((c, i) => ({ label: c.raw.categoryLevelOne.length > 20 ? c.raw.categoryLevelOne.substring(0, 18) + '...' : c.raw.categoryLevelOne, value: c.delivered, color: PALETTE[i % PALETTE.length], wowGrowth: c.wowGrowth }));

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
