import { usePriceGuardCategoryHealth } from '../../../api/priceGuard';
import { SkeletonCards } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import HealthScoreCard from './HealthScoreCard';

function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

export default function PriceGuardCategoryHealthPage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardCategoryHealth();
  const categories = data?.categories || [];

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Category Health Matrix</h1>
        <p className="text-[12px] text-secondary mt-0.5">Volume weights and pricing margins aggregated by internal product categories</p>
      </div>

      {isLoading && <SkeletonCards count={12} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <HealthScoreCard
              key={c.category_name}
              title={c.category_name}
              subtitle={`${formatNumber(c.product_count)} items`}
              metricValue={formatPercent(c.margin_pct)}
              healthScore={c.health_score}
            />
          ))}
        </div>
      )}
    </div>
  );
}
