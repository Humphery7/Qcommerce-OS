import { useMemo, useState } from 'react';
import {
  usePriceGuardMatches,
  useApprovePriceGuardMatch,
  useSavePriceGuardManualOverride,
  useTriggerPriceGuardRematch
} from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import StatusChip from '../../../components/ui/StatusChip';
import { PRICE_GUARD_ACCENT } from './priceGuardNav';

const COMPETITORS = [
  { value: 'mano', label: 'Mano' },
  { value: 'chowstore', label: 'Chowstore' },
  { value: 'spar', label: 'SPAR Market' },
  { value: 'supersaver', label: 'SuperSaver Supermarket' }
];

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
}

const emptyForm = { sku: '', competitor: COMPETITORS[0].value, name: '', price: '' };

export default function PriceGuardMatchManagementPage() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardMatches();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveOverride = useSavePriceGuardManualOverride();
  const approveMatch = useApprovePriceGuardMatch();
  const rematch = useTriggerPriceGuardRematch();

  const matches = data?.matches || [];
  const filtered = useMemo(() => {
    const rows = !search.trim()
      ? matches
      : matches.filter((m) => (m.product_sku || '').toLowerCase().includes(search.trim().toLowerCase()));
    return rows.map((m) => ({ ...m, _rowKey: `${m.product_sku}::${m.competitor}` }));
  }, [matches, search]);

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    if (!form.sku.trim() || !form.name.trim() || !form.price) {
      setFormError('SKU, competitor product name, and price are all required.');
      return;
    }
    try {
      await saveOverride.mutateAsync({
        sku: form.sku.trim(),
        competitor: form.competitor,
        name: form.name.trim(),
        price: parseFloat(form.price) || 0
      });
      setForm(emptyForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || 'Failed to save this manual match.');
    }
  }

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Matching Index Queue</h1>
        <p className="text-[12px] text-secondary mt-0.5">Approve, reject or manually match competitor names to internal SKUs</p>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-3">
        <h3 className="text-[15px] font-semibold text-on-surface">Manual Matching & Rematching Console</h3>
        {formError && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/10 text-error text-[12px]"><span className="material-symbols-outlined text-[16px]">error</span>{formError}</div>)}
        {saveSuccess && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px]"><span className="material-symbols-outlined text-[16px]">check_circle</span>Manual match saved.</div>)}
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <span className="text-[11px] font-medium text-secondary">Product SKU</span>
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Product SKU" className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
          </label>
          <label className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[11px] font-medium text-secondary">Competitor</span>
            <select value={form.competitor} onChange={(e) => setForm((f) => ({ ...f, competitor: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all">
              {COMPETITORS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className="text-[11px] font-medium text-secondary">Competitor Product Name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Competitor Product Name" className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
          </label>
          <label className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-[11px] font-medium text-secondary">Price (₦)</span>
            <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Price (₦)" className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
          </label>
          <Button type="submit" variant="primary" icon="save" loading={saveOverride.isPending} style={{ background: '#16a34a', color: '#fff' }}>Save</Button>
        </form>
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-on-surface">Pending Match Review Queue</h3>
          <div className="relative w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU…" className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
          </div>
        </div>

        {isError && <ErrorState compact error={error} onRetry={refetch} />}
        {isLoading && <SkeletonRows rows={8} cols={7} />}

        {data && !isError && (
          <DataTable
            columns={[
              { key: 'product_sku', header: 'SKU', mono: true, sortable: true },
              { key: 'competitor', header: 'Competitor', sortable: true, render: (r) => (COMPETITORS.find((c) => c.value === r.competitor)?.label || r.competitor) },
              { key: 'competitor_product_name', header: 'Matched Listing Name', sortable: true },
              { key: 'latest_price', header: 'Price', align: 'right', sortable: true, render: (r) => formatCurrency(r.latest_price) },
              { key: 'match_confidence', header: 'Confidence Score', align: 'right', sortable: true, render: (r) => `${((r.match_confidence || 0) * 100).toFixed(2)}%` },
              { key: 'match_method', header: 'Match Method', sortable: true },
              { key: 'actions', header: 'Actions', align: 'right', render: (r) => (
                r.is_approved ? (
                  <StatusChip tone="positive">Approved</StatusChip>
                ) : (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check"
                      loading={approveMatch.isPending}
                      style={{ borderColor: '#16a34a', color: '#16a34a' }}
                      onClick={() => approveMatch.mutate({ sku: r.product_sku, competitor: r.competitor })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="sync"
                      loading={rematch.isPending}
                      style={{ borderColor: PRICE_GUARD_ACCENT, color: PRICE_GUARD_ACCENT }}
                      onClick={() => rematch.mutate({ sku: r.product_sku })}
                    >
                      Rematch
                    </Button>
                  </div>
                )
              ) }
            ]}
            rows={filtered}
            rowKey="_rowKey"
            emptyMessage={search ? `No matches for SKU "${search}".` : 'No pending matches right now.'}
          />
        )}
      </section>
    </div>
  );
}
