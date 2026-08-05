import { useEffect, useMemo, useState } from 'react';
import { usePriceGuardProducts } from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';
import StatusChip from '../../../components/ui/StatusChip';

function formatCurrency(n) {
  if (!n) return '—';
  return `₦${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
}
function formatPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function riskTone(score) {
  const s = Number(score) || 0;
  if (s > 60) return 'critical';
  if (s > 30) return 'warning';
  return 'positive';
}

const PAGE_SIZE = 100;

export default function PriceGuardProductsPage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardProducts();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const products = data?.products || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (p.product_name || '').toLowerCase().includes(q) || (p.product_sku || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Catalog Inventory & Competitor Margins</h1>
        <p className="text-[12px] text-secondary mt-0.5">Detailed view of selling vs competitor prices</p>
      </div>

      {isLoading && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <div className="h-9 w-full max-w-md rounded-md bg-surface-container animate-pulse mb-3" />
          <SkeletonRows rows={10} cols={7} />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <div className="relative w-full max-w-md mb-3">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[16px]">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog items…"
              className="w-full bg-surface-container border border-outline-variant rounded-md pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
            />
          </div>

          <DataTable
            columns={[
              { key: 'product_sku', header: 'SKU', mono: true, sortable: true },
              { key: 'product_name', header: 'Product Name', sortable: true },
              { key: 'supplier_name', header: 'Supplier', sortable: true },
              { key: 'cost_price_today', header: 'Cost Today', align: 'right', sortable: true, render: (r) => formatCurrency(r.cost_price_today) },
              { key: 'cost_price_last_month', header: 'Historical Cost', align: 'right', sortable: true, render: (r) => formatCurrency(r.cost_price_last_month) },
              { key: 'selling_price_today', header: 'Selling Today', align: 'right', sortable: true, render: (r) => formatCurrency(r.selling_price_today) },
              { key: 'selling_price_last_month', header: 'Historical Selling', align: 'right', sortable: true, render: (r) => formatCurrency(r.selling_price_last_month) },
              { key: 'margin_today', header: 'Margin Today', align: 'right', sortable: true, render: (r) => <span className={r.margin_today < 0 ? 'text-error font-semibold' : ''}>{formatPercent(r.margin_today)}</span> },
              { key: 'market_median_price', header: 'Market Median', align: 'right', sortable: true, render: (r) => formatCurrency(r.market_median_price) },
              { key: 'price_index', header: 'Price Index', align: 'right', sortable: true, render: (r) => (r.price_index != null ? Math.round(r.price_index) : '—') },
              { key: 'risk_score', header: 'Risk Score', align: 'right', sortable: true, render: (r) => <StatusChip tone={riskTone(r.risk_score)}>{r.risk_score ?? 0}</StatusChip> }
            ]}
            rows={paged}
            rowKey="product_sku"
            emptyMessage={search ? `No products match "${search}".` : 'No products found yet.'}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
              <span className="text-[11px] text-secondary">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
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
