import { useEffect, useMemo, useState } from 'react';
import { usePriceGuardAlerts } from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';
import StatusChip from '../../../components/ui/StatusChip';

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0)}`;
}

const SEVERITY_OPTIONS = ['critical', 'high', 'warning'];
const ALERT_TYPE_OPTIONS = ['Cost Spike', 'Price Spike', 'Competitor Premium', 'Negative Margin', 'Margin Degradation'];
const SEVERITY_TONE = { critical: 'critical', high: 'warning', warning: 'neutral' };
const PAGE_SIZE = 100;

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="flex flex-col gap-1 min-w-[170px]">
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-surface-container border border-outline-variant rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all">
        <option value="">{placeholder}</option>
        {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      </select>
    </label>
  );
}

export default function PriceGuardAlertsPage() {
  const [severity, setSeverity] = useState('');
  const [alertType, setAlertType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (severity) f.severity = severity;
    if (alertType) f.alertType = alertType;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [severity, alertType, search]);

  const { data, isLoading, isError, error, refetch, isFetching } = usePriceGuardAlerts(filters);
  const alerts = data?.alerts || [];

  useEffect(() => { setPage(1); }, [severity, alertType, search]);

  const totalPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));
  const paged = alerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = severity || alertType || search.trim();
  const clearFilters = () => { setSeverity(''); setAlertType(''); setSearch(''); };

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Pricing Anomalies Queue</h1>
        <p className="text-[12px] text-secondary mt-0.5">Pricing adjustments and margin alerts triggered by system thresholds</p>
      </div>

      {isError && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <div className="flex gap-3 mb-3">
            <div className="h-[52px] w-[170px] rounded-md bg-surface-container animate-pulse" />
            <div className="h-[52px] w-[170px] rounded-md bg-surface-container animate-pulse" />
            <div className="h-[52px] flex-1 rounded-md bg-surface-container animate-pulse" />
          </div>
          <SkeletonRows rows={8} cols={5} />
        </div>
      )}

      {data && !isError && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
          <div className="flex items-end gap-3 flex-wrap mb-3">
            <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} placeholder="All severities" />
            <FilterSelect label="Alert Type" value={alertType} onChange={setAlertType} options={ALERT_TYPE_OPTIONS} placeholder="All types" />
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[11px] font-medium text-secondary">Search</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or product name…" className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
              </div>
            </label>
            {hasActiveFilters && (<button onClick={clearFilters} className="text-[12px] font-medium text-accent-container hover:underline shrink-0 mb-[3px]">Clear filters</button>)}
            {isFetching && !isLoading && <span className="material-symbols-outlined text-[16px] animate-spin text-secondary mb-1.5">progress_activity</span>}
          </div>

          <DataTable
            columns={[
              { key: 'product_name', header: 'Product / SKU', sortable: true, render: (r) => (
                <div>
                  <p className="font-medium text-on-surface">{r.product_name}</p>
                  <p className="text-[11px] text-secondary font-mono">SKU: {r.product_sku}</p>
                </div>
              ) },
              { key: 'alert_type', header: 'Alert Type', sortable: true },
              { key: 'details', header: 'Explanation / Details' },
              { key: 'severity', header: 'Severity', sortable: true, render: (r) => <StatusChip tone={SEVERITY_TONE[r.severity] || 'muted'}>{(r.severity || '').toUpperCase()}</StatusChip> },
              { key: 'revenue_latest', header: 'Revenue Weight', align: 'right', sortable: true, render: (r) => <span className="text-error font-semibold">{formatCurrency(r.revenue_latest)}</span> }
            ]}
            rows={paged}
            rowKey="product_sku"
            emptyMessage={hasActiveFilters ? 'No alerts match these filters.' : 'No pricing alerts right now — nice.'}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
              <span className="text-[11px] text-secondary">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, alerts.length)} of {alerts.length}</span>
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
