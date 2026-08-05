import { useEffect, useMemo, useState } from 'react';
import { useWeightedAvailabilityForecastingProducts } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import KpiCard from '../../components/ui/KpiCard';
import StatusChip from '../../components/ui/StatusChip';

function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
function formatDays(n) {
  if (n === null || n === undefined || n === '') return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} ${Math.abs(rounded) === 1 ? 'day' : 'days'}`;
}

function statusTone(status) {
  const s = (status || '').toLowerCase();
  if (!s) return 'muted';
  if (s.includes('out') || s.includes('critical') || s.includes('urgent')) return 'critical';
  if (s.includes('low') || s.includes('risk') || s.includes('watch')) return 'warning';
  if (s.includes('over') || s.includes('excess')) return 'neutral';
  if (s.includes('healthy') || s.includes('ok') || s.includes('good') || s.includes('sufficient')) return 'positive';
  return 'muted';
}

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="flex flex-col gap-1 min-w-[140px]">
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-surface-container border border-outline-variant rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all">
        <option value="">{placeholder}</option>
        {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      </select>
    </label>
  );
}

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1 min-w-[160px] flex-1">
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
      </div>
    </label>
  );
}

const PAGE_SIZE = 100;

export default function WeightedAvailabilityForecastPage() {
  const { data, isLoading, isError, error, refetch } = useWeightedAvailabilityForecastingProducts();
  const [warehouse, setWarehouse] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [page, setPage] = useState(1);

  const products = data?.products || [];

  const { warehouseOptions, categoryOptions } = useMemo(() => {
    const warehouses = new Set(); const categories = new Set();
    products.forEach((p) => { if (p.warehouse) warehouses.add(p.warehouse); if (p.categoryLevelOne) categories.add(p.categoryLevelOne); });
    return { warehouseOptions: [...warehouses].sort(), categoryOptions: [...categories].sort() };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const skuQuery = sku.trim().toLowerCase(); const nameQuery = productName.trim().toLowerCase();
    return products.filter((p) => {
      if (warehouse && p.warehouse !== warehouse) return false;
      if (category && p.categoryLevelOne !== category) return false;
      if (skuQuery && !(p.sku || '').toLowerCase().includes(skuQuery)) return false;
      if (nameQuery && !(p.productName || '').toLowerCase().includes(nameQuery)) return false;
      return true;
    });
  }, [products, warehouse, category, sku, productName]);

  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const critical = filteredProducts.filter((p) => statusTone(p.inventoryStatus) === 'critical').length;
    const watch = filteredProducts.filter((p) => statusTone(p.inventoryStatus) === 'warning').length;
    const avgDaysLeft = total === 0 ? 0 : filteredProducts.reduce((sum, p) => sum + (Number(p.daysInventoryWillLast) || 0), 0) / total;
    return { total, critical, watch, avgDaysLeft };
  }, [filteredProducts]);

  useEffect(() => { setPage(1); }, [warehouse, category, sku, productName, data]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = warehouse || category || sku.trim() || productName.trim();
  const clearFilters = () => { setWarehouse(''); setCategory(''); setSku(''); setProductName(''); };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-on-surface">Product Forecast</h2>
        <p className="text-[11px] text-secondary">Purchase orders vs. demand and current inventory — "Are we ordering enough?"</p>
      </div>

      {isLoading && <LoadingPanel message={'Loading forecasting data…'} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Products Shown" value={formatNumber(stats.total)} icon="inventory_2" />
            <KpiCard label="Critical Stock" value={formatNumber(stats.critical)} icon="error" critical={stats.critical > 0} />
            <KpiCard label="Needs Watching" value={formatNumber(stats.watch)} icon="visibility" />
            <KpiCard label="Avg. Days of Cover" value={formatDays(stats.avgDaysLeft)} icon="calendar_month" />
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
            <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-end gap-3 flex-wrap flex-1">
                <FilterSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={warehouseOptions} placeholder="All warehouses" />
                <FilterSelect label="Category" value={category} onChange={setCategory} options={categoryOptions} placeholder="All categories" />
                <FilterInput label="SKU" value={sku} onChange={setSku} placeholder="Search SKU..." />
                <FilterInput label="Product Name" value={productName} onChange={setProductName} placeholder="Search product name..." />
              </div>
              {hasActiveFilters && (<button onClick={clearFilters} className="text-[12px] font-medium text-accent-container hover:underline shrink-0 pb-[2px]">Clear filters</button>)}
            </div>

            <DataTable
              columns={[
                { key: 'warehouse', header: 'Warehouse', sortable: true },
                { key: 'sku', header: 'SKU', mono: true, sortable: true },
                { key: 'productName', header: 'Product Name', sortable: true },
                { key: 'categoryLevelOne', header: 'Category', sortable: true },
                { key: 'avgDailySales', header: 'Avg Daily Sales', align: 'right', sortable: true, render: (r) => formatNumber(r.avgDailySales) },
                { key: 'lastQuantityOrdered', header: 'Last Qty Ordered', align: 'right', sortable: true, render: (r) => formatNumber(r.lastQuantityOrdered) },
                { key: 'lastQuantityReceived', header: 'Last Qty Received', align: 'right', sortable: true, render: (r) => formatNumber(r.lastQuantityReceived) },
                { key: 'daysInventoryWillLast', header: 'Days Inventory Will Last', align: 'right', sortable: true, render: (r) => { const days = Number(r.daysInventoryWillLast); const low = Number.isFinite(days) && days <= 3; return <span className={low ? 'text-error font-semibold' : ''}>{formatDays(r.daysInventoryWillLast)}</span>; } },
                { key: 'orderingPattern', header: 'Ordering Pattern', sortable: true },
                { key: 'daysUntilNextOrder', header: 'Days Until Next Order', align: 'right', sortable: true, render: (r) => formatDays(r.daysUntilNextOrder) },
                { key: 'suggestedNextOrderQuantity', header: 'Suggested Next Order Qty', align: 'right', sortable: true, render: (r) => formatNumber(r.suggestedNextOrderQuantity) },
                { key: 'inventoryStatus', header: 'Inventory Status', sortable: true, render: (r) => r.inventoryStatus ? <StatusChip tone={statusTone(r.inventoryStatus)}>{r.inventoryStatus}</StatusChip> : '—' },
                { key: 'recommendedAction', header: 'Recommended Action', sortable: true, render: (r) => r.recommendedAction || '—' }
              ]}
              rows={pagedProducts}
              emptyMessage={hasActiveFilters ? 'No products match these filters.' : 'No forecasting data available yet.'}
            />

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
                <span className="text-[11px] text-secondary">
                  Showing {(page - 1) * PAGE_SIZE + 1}{' – '}{Math.min(page * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    Prev
                  </button>
                  <span className="text-[11px] text-secondary px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
