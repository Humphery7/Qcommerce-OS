import { useEffect, useMemo, useState } from 'react';
import ComparisonBarChart from '../charts/ComparisonBarChart';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';

const PAGE_SIZE = 150;

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }
function formatGrowth(n) { if (n === null || n === undefined || Number.isNaN(n)) return '\u2014'; return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`; }
function formatPercent(n) { if (n === null || n === undefined || Number.isNaN(n)) return '\u2014'; return `${n.toFixed(1)}%`; }

// products from MfcAnalyticsService carry overall figures at the top level
// plus a losf1/mnlf1 sub-object each with the same shape - this picks which
// one to read from based on the selected store.
function getMetrics(row, store) {
  if (store === 'losf1' || store === 'mnlf1') {
    const s = row[store] || {};
    return { delivered: s.delivered || 0, orders: s.orders || 0, wowGrowth: s.wowGrowth, pctContribution: s.pctContribution };
  }
  return { delivered: row.delivered7d, orders: row.orders7d, wowGrowth: row.wowGrowthDelivered, pctContribution: row.pctContributionOrders };
}

const STORE_LABELS = { overall: 'Overall', losf1: 'LOSF1', mnlf1: 'MNLF1' };

export default function ProductSalesPanel({ products, store = 'overall' }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.productNameLocal.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const topChartData = useMemo(() => {
    return [...(products || [])]
      .map((p) => ({ raw: p, ...getMetrics(p, store) }))
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 10)
      .map((p) => ({ label: p.raw.productNameLocal.length > 22 ? p.raw.productNameLocal.substring(0, 20) + '...' : p.raw.productNameLocal, value: p.delivered }));
  }, [products, store]);

  if (!products || products.length === 0) return <EmptyState message="No product sales data available yet." />;

  const storeSuffix = store === 'overall' ? '' : ` (${STORE_LABELS[store]})`;

  return (
    <div className="flex flex-col gap-3">
      <ComparisonBarChart data={topChartData} layout="horizontal" height={320} valueFormatter={formatNumber} color="var(--accent-container)" />

      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[13px] font-semibold text-on-surface">All Products</h4>
        <div className="relative w-48">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'sku', header: 'SKU', mono: true, sortable: true },
          { key: 'productNameLocal', header: 'Product', sortable: true },
          { key: 'categoryLevelOne', header: 'Category', sortable: true },
          { key: 'delivered7d', header: `Delivered This Week${storeSuffix}`, align: 'right', sortable: true, sortValue: (r) => getMetrics(r, store).delivered, render: (r) => formatNumber(getMetrics(r, store).delivered) },
          { key: 'orders7d', header: `Orders This Week${storeSuffix}`, align: 'right', sortable: true, sortValue: (r) => getMetrics(r, store).orders, render: (r) => formatNumber(getMetrics(r, store).orders) },
          { key: 'wowGrowthDelivered', header: `WoW Growth${storeSuffix}`, align: 'right', sortable: true, sortValue: (r) => getMetrics(r, store).wowGrowth, render: (r) => { const g = getMetrics(r, store).wowGrowth; return <span className={g > 0 ? 'text-emerald-600 font-semibold' : g < 0 ? 'text-error font-semibold' : ''}>{formatGrowth(g)}</span>; } },
          { key: 'pctContributionOrders', header: `% of Orders${storeSuffix}`, align: 'right', sortable: true, sortValue: (r) => getMetrics(r, store).pctContribution, render: (r) => formatPercent(getMetrics(r, store).pctContribution) }
        ]}
        rows={pagedRows}
        rowKey="sku"
        emptyMessage={search ? `No products match "${search}".` : 'No product sales data available yet.'}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-outline-variant/50">
          <span className="text-[11px] text-secondary">Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 rounded text-[11px] font-medium bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-all">&larr; Prev</button>
            <span className="text-[11px] text-secondary px-1">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 rounded text-[11px] font-medium bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next &rarr;</button>
          </div>
        </div>
      )}
    </div>
  );
}
