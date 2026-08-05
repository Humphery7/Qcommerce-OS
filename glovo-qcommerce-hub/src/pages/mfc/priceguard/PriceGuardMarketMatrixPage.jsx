import { useMemo } from 'react';
import { usePriceGuardMatches, usePriceGuardProducts } from '../../../api/priceGuard';
import { SkeletonBlock } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import ComparisonBarChart from '../../../components/charts/ComparisonBarChart';

const COMPETITOR_LABELS = {
  mano: 'Mano',
  chowstore: 'Chowstore',
  spar: 'SPAR Market',
  supersaver: 'SuperSaver Supermarket'
};

export default function PriceGuardMarketMatrixPage() {
  const matchesQuery = usePriceGuardMatches();
  const productsQuery = usePriceGuardProducts();

  const isLoading = matchesQuery.isLoading || productsQuery.isLoading;
  const firstError = [matchesQuery, productsQuery].find((q) => q.isError);

  const chartData = useMemo(() => {
    const matches = matchesQuery.data?.matches || [];
    const products = productsQuery.data?.products || [];
    if (!matches.length || !products.length) return [];

    const priceBySku = new Map(products.map((p) => [p.product_sku, p.selling_price_today]));
    const sums = {};
    matches.forEach((m) => {
      const ourPrice = priceBySku.get(m.product_sku);
      if (!ourPrice || !m.latest_price) return;
      const index = (m.latest_price / ourPrice) * 100;
      const key = m.competitor;
      if (!sums[key]) sums[key] = { total: 0, count: 0 };
      sums[key].total += index;
      sums[key].count += 1;
    });

    return Object.entries(sums)
      .map(([competitor, { total, count }]) => {
        const value = +(total / count).toFixed(1);
        return {
          label: COMPETITOR_LABELS[competitor] || competitor,
          value,
          color: value <= 100 ? '#00A082' : '#d92d20'
        };
      })
      .sort((a, b) => a.value - b.value);
  }, [matchesQuery.data, productsQuery.data]);

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Competitor Pricing Index Matrix</h1>
        <p className="text-[12px] text-secondary mt-0.5">Comparative price index analysis per major competitor</p>
      </div>

      {isLoading && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <SkeletonBlock height={320} />
        </div>
      )}
      {firstError && <ErrorState error={firstError.error} onRetry={firstError.refetch} />}

      {!isLoading && !firstError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <ComparisonBarChart
            data={chartData}
            layout="horizontal"
            height={Math.max(220, chartData.length * 90)}
            valueFormatter={(v) => Math.round(v)}
          />
          <p className="text-[11px] text-secondary text-center mt-2">Price Index (100 = matches competitor price)</p>
        </div>
      )}
    </div>
  );
}
