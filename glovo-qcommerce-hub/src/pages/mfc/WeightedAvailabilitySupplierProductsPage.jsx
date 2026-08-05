import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWeightedAvailabilityProductsForSupplier } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import KpiCard from '../../components/ui/KpiCard';
import Sparkline from '../../components/mfc/Sparkline';
import Button from '../../components/ui/Button';

function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
}
function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function formatAvailabilityPercent(n) {
  return `${(n || 0).toFixed(1)}%`;
}
function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

export default function WeightedAvailabilitySupplierProductsPage() {
  const { supplierName } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const decodedName = decodeURIComponent(supplierName || '');
  const { data, isLoading, isError, error, refetch } = useWeightedAvailabilityProductsForSupplier(decodedName);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    if (!search.trim()) return data.products;
    const q = search.trim().toLowerCase();
    return data.products.filter(
      (p) => p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      {isLoading && <LoadingPanel message={`Loading products for ${decodedName}…`} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon="arrow_back" onClick={() => navigate('/mfc/weighted-availability/summary')} />
            <div>
              <h2 className="text-[16px] font-semibold text-on-surface">{decodedName}</h2>
              <p className="text-[11px] text-secondary">Product-level availability performance for this supplier.</p>
            </div>
          </div>

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
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or SKU..."
                  className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
              </div>
            </div>

            <DataTable
              columns={[
                { key: 'sku', header: 'SKU', mono: true, sortable: true },
                { key: 'productName', header: 'Product', sortable: true },
                { key: 'categoryLevelOne', header: 'Category', sortable: true },
                { key: 'currentAvailability', header: 'Current Availability', align: 'right', sortable: true, render: (r) => r.currentAvailability !== undefined ? (<span className={r.currentAvailability < 80 ? 'text-error font-semibold' : 'font-semibold'}>{formatAvailabilityPercent(r.currentAvailability)}</span>) : '—' },
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
    </div>
  );
}
