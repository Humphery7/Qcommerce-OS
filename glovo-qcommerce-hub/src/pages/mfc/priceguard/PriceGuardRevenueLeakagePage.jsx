import { useEffect, useMemo, useState } from 'react';
import { usePriceGuardProducts } from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0)}`;
}

const PAGE_SIZE = 100;

export default function PriceGuardRevenueLeakagePage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardProducts();
  const [page, setPage] = useState(1);

  const atRisk = useMemo(() => {
    const products = data?.products || [];
    return products
      .filter((p) => (p.price_index || 0) > 120)
      .sort((a, b) => (b.revenue_at_risk || 0) - (a.revenue_at_risk || 0));
  }, [data]);

  useEffect(() => { setPage(1); }, [data]);

  const totalPages = Math.max(1, Math.ceil(atRisk.length / PAGE_SIZE));
  const paged = atRisk.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Revenue At Risk Analysis</h1>
        <p className="text-[12px] text-secondary mt-0.5">Valuable items facing drop in demand due to higher market premiums</p>
      </div>

      {isLoading && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <SkeletonRows rows={10} cols={6} />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <DataTable
            columns={[
              { key: 'product_name', header: 'Product', sortable: true },
              { key: 'selling_price_today', header: 'Today Price', align: 'right', sortable: true, render: (r) => formatCurrency(r.selling_price_today) },
              { key: 'market_median_price', header: 'Market Median', align: 'right', sortable: true, render: (r) => formatCurrency(r.market_median_price) },
              { key: 'price_index', header: 'Price Index', align: 'right', sortable: true, render: (r) => Math.round(r.price_index || 0) },
              { key: 'revenue_latest', header: 'Monthly Revenue', align: 'right', sortable: true, render: (r) => formatCurrency(r.revenue_latest) },
              { key: 'revenue_at_risk', header: 'Risk Contribution', align: 'right', sortable: true, render: (r) => <span className="text-error font-semibold bg-error/10 px-2 py-0.5 rounded">{formatCurrency(r.revenue_at_risk)}</span> }
            ]}
            rows={paged}
            rowKey="product_sku"
            emptyMessage="No products are currently priced significantly above the market median — nice."
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
              <span className="text-[11px] text-secondary">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, atRisk.length)} of {atRisk.length}</span>
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
