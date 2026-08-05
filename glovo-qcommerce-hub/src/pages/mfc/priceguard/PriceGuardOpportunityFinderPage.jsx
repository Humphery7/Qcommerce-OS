import { useEffect, useMemo, useState } from 'react';
import { usePriceGuardProducts } from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';
import StatusChip from '../../../components/ui/StatusChip';

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0)}`;
}
function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

const PAGE_SIZE = 100;

export default function PriceGuardOpportunityFinderPage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardProducts();
  const [page, setPage] = useState(1);

  const opportunities = useMemo(() => {
    const products = data?.products || [];
    return products
      .filter((p) => (p.opportunity_score || 0) > 50)
      .map((p) => {
        const gap = (p.market_median_price || 0) - (p.selling_price_today || 0);
        return { ...p, _gap: gap, _potentialProfit: gap * (p.quantity_sold_latest || 0) };
      })
      .sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
  }, [data]);

  useEffect(() => { setPage(1); }, [data]);

  const totalPages = Math.max(1, Math.ceil(opportunities.length / PAGE_SIZE));
  const paged = opportunities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Smart Price Optimization Recommendations</h1>
        <p className="text-[12px] text-secondary mt-0.5">Items priced lower than competitor averages offering margin expansion potential</p>
      </div>

      {isLoading && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <SkeletonRows rows={10} cols={7} />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <DataTable
            columns={[
              { key: 'product_name', header: 'Product', sortable: true },
              { key: 'selling_price_today', header: 'Selling Price', align: 'right', sortable: true, render: (r) => formatCurrency(r.selling_price_today) },
              { key: 'market_median_price', header: 'Market Median', align: 'right', sortable: true, render: (r) => formatCurrency(r.market_median_price) },
              { key: '_gap', header: 'Gap', align: 'right', sortable: true, render: (r) => formatCurrency(r._gap) },
              { key: 'quantity_sold_latest', header: 'Monthly Sales Volume', align: 'right', sortable: true, render: (r) => formatNumber(r.quantity_sold_latest) },
              { key: '_potentialProfit', header: 'Potential Monthly Profit', align: 'right', sortable: true, render: (r) => formatCurrency(r._potentialProfit) },
              { key: 'opportunity_score', header: 'Opportunity Rating', align: 'right', sortable: true, render: (r) => <StatusChip tone={r.opportunity_score >= 80 ? 'positive' : 'neutral'}>RATING: {Math.round(r.opportunity_score)}</StatusChip> }
            ]}
            rows={paged}
            rowKey="product_sku"
            emptyMessage="No margin-expansion opportunities right now."
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
              <span className="text-[11px] text-secondary">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, opportunities.length)} of {opportunities.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-[15px]">chevron_left</span>Prev
                </button>
                <span className="text-[11px] text-secondary px-2">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next<span className="material-symbols-outlined text-[15px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
