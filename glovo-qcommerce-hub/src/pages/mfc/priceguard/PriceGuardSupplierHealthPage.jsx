import { usePriceGuardSupplierHealth } from '../../../api/priceGuard';
import { SkeletonCards } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import HealthScoreCard from './HealthScoreCard';

function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

export default function PriceGuardSupplierHealthPage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardSupplierHealth();
  const suppliers = data?.suppliers || [];

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Supplier Performance Matrix</h1>
        <p className="text-[12px] text-secondary mt-0.5">Margin values and pricing accuracy health scores aggregated by suppliers</p>
      </div>

      {isLoading && <SkeletonCards count={9} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <HealthScoreCard
              key={s.supplier_name}
              title={s.supplier_name}
              subtitle={`${formatNumber(s.product_count)} active matched SKUs`}
              metricValue={formatPercent(s.margin_pct)}
              healthScore={s.health_score}
            />
          ))}
        </div>
      )}
    </div>
  );
}
