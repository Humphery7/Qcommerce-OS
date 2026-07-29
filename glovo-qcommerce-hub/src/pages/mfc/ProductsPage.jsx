import { useEffect, useMemo, useState } from 'react';
import { useProductsForSupplier, useSupplierList } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import KpiCard from '../../components/ui/KpiCard';
import Sparkline from '../../components/mfc/Sparkline';

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }
function formatPercent(n) { return `${((n || 0) * 100).toFixed(1)}%`; }
function formatCurrency(n) { return `₦${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`; }

export default function ProductsPage() {
  const { data: supplierListData, isLoading: isLoadingSuppliers, isError: isSupplierListError, error: supplierListError, refetch: refetchSuppliers } = useSupplierList();
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [search, setSearch] = useState('');

  const suppliers = supplierListData?.suppliers || [];

  useEffect(() => {
    if (!selectedSupplier && suppliers.length > 0) { setSelectedSupplier(suppliers[0]); }
  }, [suppliers, selectedSupplier]);

  const { data, isLoading, isError, error, refetch } = useProductsForSupplier(selectedSupplier);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    if (!search.trim()) return data.products;
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[16px] font-semibold text-on-surface">Products</h2>
          <p className="text-[11px] text-secondary">Product-level availability performance, by supplier.</p>
        </div>
        <label className="flex flex-col gap-1 min-w-[200px]">
          <span className="text-[11px] font-medium text-secondary">Supplier</span>
          {isLoadingSuppliers ? (
            <div className="h-7 rounded-md bg-surface-container animate-pulse" />
          ) : (
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
            >
              {suppliers.map((name) => (<option key={name} value={name}>{name}</option>))}
            </select>
          )}
        </label>
      </div>

      {isSupplierListError && <ErrorState error={supplierListError} onRetry={refetchSuppliers} />}
      {!isSupplierListError && !isLoadingSuppliers && suppliers.length === 0 && (<EmptyState icon="factory" message="No suppliers found yet." />)}

      {selectedSupplier && (
        <>
          {isLoading && <LoadingPanel message={`Loading products for ${selectedSupplier}\u2026`} />}
          {isError && <ErrorState error={error} onRetry={refetch} />}

          {data && !isError && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Products Assigned" value={formatNumber(data.summary?.productsAssigned)} icon="inventory_2" />
                <KpiCard label="Qty Ordered" value={formatNumber(data.summary?.quantityOrdered)} icon="shopping_cart" />
                <KpiCard label="Qty Received" value={formatNumber(data.summary?.quantityReceived)} icon="move_to_inbox" />
                <KpiCard label="Fill Rate" value={formatPercent(data.summary?.fillRate)} icon="percent" critical={(data.summary?.fillRate || 0) < 0.8} />
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h3 className="text-[14px] font-semibold text-on-surface">Products</h3>
                  <div className="relative w-56">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
                  </div>
                </div>

                <DataTable
                  columns={[
                    { key: 'sku', header: 'SKU', mono: true, sortable: true },
                    { key: 'productName', header: 'Product Name', sortable: true },
                    { key: 'categoryLevelOne', header: 'Categories', sortable: true },
                    { key: 'currentAvailability', header: 'Current Availability', align: 'right', sortable: true, render: (r) => r.currentAvailability !== undefined ? (<span className={r.currentAvailability < 0.8 ? 'text-error font-semibold' : 'font-semibold'}>{formatPercent(r.currentAvailability)}</span>) : '\u2014' },
                    { key: 'quantityOrdered', header: 'Quantity Ordered', align: 'right', sortable: true, render: (r) => formatNumber(r.quantityOrdered) },
                    { key: 'quantityReceived', header: 'Quantity Received', align: 'right', sortable: true, render: (r) => formatNumber(r.quantityReceived) },
                    { key: 'fillRate', header: 'Fill Rate', align: 'right', sortable: true, render: (r) => (<span className={r.fillRate < 0.8 ? 'text-error font-semibold' : 'font-semibold'}>{formatPercent(r.fillRate)}</span>) },
                    { key: 'latestCost', header: 'Latest Cost', align: 'right', mono: true, sortable: true, render: (r) => formatCurrency(r.latestCost) },
                    { key: 'weeklyTrend', header: '6-Week Trend', align: 'right', render: (r) => (<div className="flex justify-end"><Sparkline data={r.weeklyTrend} /></div>) }
                  ]}
                  rows={filteredProducts}
                  rowKey="sku"
                  emptyMessage={search ? `No products match "${search}".` : 'This supplier has no assigned products.'}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
