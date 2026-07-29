import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupplierSummary } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import PeriodToggle from '../../components/mfc/PeriodToggle';
import Button from '../../components/ui/Button';

function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
}
function formatPercent(n) {
  return `${(n || 0).toFixed(1)}%`;
}

const FIELD_SUFFIX = {
  monthly: { current: 'Current', prev1: 'M1', prev2: 'M2' },
  weekly: { current: 'WeekCurrent', prev1: 'W1', prev2: 'W2' }
};

export default function SupplierSummaryPage() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('monthly_current');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch } = useSupplierSummary();

  const [periodType, timeframe] = selectedPeriod.split('_');
  const suffix = FIELD_SUFFIX[periodType][timeframe];

  const filteredSuppliers = useMemo(() => {
    if (!data?.suppliers) return [];
    if (!search.trim()) return data.suppliers;
    const q = search.trim().toLowerCase();
    return data.suppliers.filter((s) => s.supplierName.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-on-surface">Supplier Summary</h2>
        <PeriodToggle value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {isLoading && <LoadingPanel message={'Loading supplier summary\u2026'} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {data && !isError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-[14px] font-semibold text-on-surface">
              Supplier Performance — {selectedPeriod.replace('_', ' ').replace(/(^\w|\s\w)/g, (c) => c.toUpperCase())}
            </h3>
            <div className="relative w-56">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
              />
            </div>
          </div>

          <DataTable
            columns={[
              { key: 'supplierName', header: 'Supplier', sortable: true },
              { key: 'products', header: 'Products', align: 'right', sortable: true, sortValue: (r) => r[`productCount${suffix}`], render: (r) => formatNumber(r[`productCount${suffix}`]) },
              { key: 'ordered', header: 'Ordered', align: 'right', sortable: true, sortValue: (r) => r[`ordered${suffix}`], render: (r) => formatNumber(r[`ordered${suffix}`]) },
              { key: 'received', header: 'Received', align: 'right', sortable: true, sortValue: (r) => r[`received${suffix}`], render: (r) => formatNumber(r[`received${suffix}`]) },
              { key: 'fillRate', header: 'Fill Rate', align: 'right', sortable: true, sortValue: (r) => r[`fillRate${suffix}`] || 0, render: (r) => { const rate = r[`fillRate${suffix}`] || 0; return <span className={rate < 80 ? 'text-error font-semibold' : 'font-semibold'}>{formatPercent(rate)}</span>; } },
              { key: 'action', header: '', align: 'right', render: (r) => (<Button variant="ghost" size="sm" icon="chevron_right" onClick={() => navigate(`/mfc/suppliers/${encodeURIComponent(r.supplierName)}`)}>Products</Button>) }
            ]}
            rows={filteredSuppliers}
            rowKey="supplierName"
            emptyMessage={search ? `No suppliers match "${search}".` : 'No suppliers found.'}
          />
        </div>
      )}
    </div>
  );
}
