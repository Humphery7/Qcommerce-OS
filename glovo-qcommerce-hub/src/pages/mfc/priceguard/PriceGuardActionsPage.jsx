import { useMemo, useState } from 'react';
import {
  usePriceGuardProducts,
  usePriceGuardPendingRecommendations,
  usePriceGuardRecommendationHistory,
  useSubmitPriceGuardRecommendation,
  useApprovePriceGuardRecommendation,
  useApprovePriceGuardRecommendations,
  useRejectPriceGuardRecommendation
} from '../../../api/priceGuard';
import { SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import StatusChip from '../../../components/ui/StatusChip';
import { PRICE_GUARD_ACCENT } from './priceGuardNav';

const REASON_OPTIONS = [
  'Cost spike not yet reflected in selling price',
  'Undercut by competitor',
  'Margin expansion opportunity',
  'Seasonal / promotional adjustment',
  'Manual pricing review',
  'Other'
];

const STATUS_TONE = { Pending: 'warning', Approved: 'positive', Rejected: 'critical' };

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0)}`;
}
function formatPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

const emptyForm = { sku: '', supplier: '', productName: '', currentSellingPrice: '', currentCost: '', recommendedPrice: '', effectiveDate: '', reason: REASON_OPTIONS[0], comments: '' };

export default function PriceGuardActionsPage() {
  const { data: productsData } = usePriceGuardProducts();
  const products = productsData?.products || [];

  const [productSearch, setProductSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const searchResults = useMemo(() => {
    if (!productSearch.trim() || !showResults) return [];
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => p.product_name.toLowerCase().includes(q) || p.product_sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productSearch, showResults]);

  const submitMutation = useSubmitPriceGuardRecommendation();

  function selectProduct(p) {
    setSelectedProduct(p);
    setForm((f) => ({
      ...f,
      sku: p.product_sku,
      supplier: p.supplier_name,
      productName: p.product_name,
      currentSellingPrice: String(p.selling_price_today ?? ''),
      currentCost: String(p.cost_price_today ?? '')
    }));
    setProductSearch(`${p.product_name} (${p.product_sku})`);
    setShowResults(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setSelectedProduct(null);
    setProductSearch('');
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.sku.trim()) { setFormError('Search and select a product first.'); return; }
    const current = parseFloat(form.currentSellingPrice) || 0;
    const recommended = parseFloat(form.recommendedPrice);
    if (!recommended) { setFormError('Enter a recommended selling price.'); return; }
    const cost = parseFloat(form.currentCost) || 0;
    const qty = selectedProduct?.quantity_sold_latest || 0;
    const actionType = recommended > current ? 'price_increase' : recommended < current ? 'price_decrease' : 'no_change';
    const expectedMargin = recommended > 0 ? (recommended - cost) / recommended : 0;
    const expectedProfitImpact = (recommended - current) * qty;

    try {
      await submitMutation.mutateAsync({
        recommendation_date: form.effectiveDate || undefined,
        product_sku: form.sku,
        product_name: form.productName,
        supplier_name: form.supplier,
        category_level_1: selectedProduct?.category_level_1 || '',
        action_type: actionType,
        current_price: current,
        recommended_price: recommended,
        expected_margin: expectedMargin,
        expected_profit_impact: expectedProfitImpact,
        reason: form.comments.trim() ? `${form.reason} — ${form.comments.trim()}` : form.reason
      });
      resetForm();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || 'Failed to submit this recommendation.');
    }
  }

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Pricing Actions</h1>
        <p className="text-[12px] text-secondary mt-0.5">Submit pricing recommendations for approval.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold text-on-surface">New Pricing Recommendation</h3>

          {formError && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/10 text-error text-[12px]"><span className="material-symbols-outlined text-[16px]">error</span>{formError}</div>)}
          {submitSuccess && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px]"><span className="material-symbols-outlined text-[16px]">check_circle</span>Recommendation submitted.</div>)}

          <label className="flex flex-col gap-1 relative">
            <span className="text-[12px] font-medium text-on-surface">Search Product</span>
            <input
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Search by SKU or Product Name…"
              className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-md shadow-popover z-20 max-h-56 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    type="button"
                    key={p.product_sku}
                    onMouseDown={() => selectProduct(p)}
                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-surface-container transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{p.product_name}</span>
                    <span className="font-mono text-secondary shrink-0">{p.product_sku}</span>
                  </button>
                ))}
              </div>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">SKU</span><input readOnly value={form.sku} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono opacity-80" /></label>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Supplier</span><input readOnly value={form.supplier} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] opacity-80" /></label>
          </div>

          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Product Name</span><input readOnly value={form.productName} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] opacity-80" /></label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Current Selling Price</span><input readOnly value={form.currentSellingPrice} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono opacity-80" /></label>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Current Cost</span><input readOnly value={form.currentCost} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono opacity-80" /></label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-on-surface">Recommended Selling Price</span>
              <input type="number" step="0.01" min="0" value={form.recommendedPrice} onChange={(e) => setForm((f) => ({ ...f, recommendedPrice: e.target.value }))} placeholder="Enter new selling price" className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-on-surface">Effective Date</span>
              <input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-on-surface">Reason</span>
            <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all">
              {REASON_OPTIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-on-surface">Comments</span>
            <textarea value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} placeholder="Optional comments…" rows={3} className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all resize-y" />
          </label>

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="primary" icon="send" loading={submitMutation.isPending} style={{ background: PRICE_GUARD_ACCENT, color: '#fff' }}>Submit Recommendation</Button>
            <Button type="button" variant="secondary" onClick={resetForm}>Clear</Button>
          </div>
        </form>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card">
          <h3 className="text-[15px] font-semibold text-on-surface mb-3">Current Product Details</h3>
          <div className="flex flex-col divide-y divide-outline-variant/50">
            {[
              { label: 'Current Selling Price', value: selectedProduct ? formatCurrency(selectedProduct.selling_price_today) : null },
              { label: 'Current Cost', value: selectedProduct ? formatCurrency(selectedProduct.cost_price_today) : null },
              { label: 'Current Margin', value: selectedProduct ? formatPercent(selectedProduct.margin_today) : null },
              { label: 'Last Price Change', value: null }
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-[13px]">
                <span className="text-secondary">{row.label}</span>
                <span className="font-medium text-on-surface">{row.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PendingRecommendations />
      <RecommendationHistory />
    </div>
  );
}

function PendingRecommendations() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardPendingRecommendations();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const approveOne = useApprovePriceGuardRecommendation();
  const approveMany = useApprovePriceGuardRecommendations();
  const reject = useRejectPriceGuardRecommendation();

  const recommendations = data?.recommendations || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return recommendations;
    const q = search.trim().toLowerCase();
    return recommendations.filter((r) => r.product_name.toLowerCase().includes(q) || r.product_sku.toLowerCase().includes(q));
  }, [recommendations, search]);

  function toggleId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[15px] font-semibold text-on-surface">Pending Pricing Recommendations</h3>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="primary" size="sm" icon="done_all" loading={approveMany.isPending} style={{ background: PRICE_GUARD_ACCENT, color: '#fff' }} onClick={() => approveMany.mutateAsync([...selectedIds]).then(() => setSelectedIds(new Set()))}>
              Approve {selectedIds.size} Selected
            </Button>
          )}
          <div className="relative w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recommendations…" className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
          </div>
        </div>
      </div>

      {isError && <ErrorState compact error={error} onRetry={refetch} />}
      {isLoading && <SkeletonRows rows={4} cols={9} />}

      {data && !isError && (
        <DataTable
          columns={[
            { key: 'select', header: '', render: (r) => (<input type="checkbox" checked={selectedIds.has(r.recommendation_id)} onChange={() => toggleId(r.recommendation_id)} />) },
            { key: 'product_name', header: 'Product / SKU', render: (r) => (<div><p className="font-medium text-on-surface">{r.product_name}</p><p className="text-[11px] text-secondary font-mono">{r.product_sku}</p></div>) },
            { key: 'supplier_name', header: 'Supplier' },
            { key: 'action_type', header: 'Action', render: (r) => r.action_type?.replace('_', ' ') },
            { key: 'current_price', header: 'Current', align: 'right', render: (r) => formatCurrency(r.current_price) },
            { key: 'recommended_price', header: 'Recommended', align: 'right', render: (r) => formatCurrency(r.recommended_price) },
            { key: 'expected_margin', header: 'Exp. Margin', align: 'right', render: (r) => formatPercent(r.expected_margin) },
            { key: 'expected_profit_impact', header: 'Exp. Impact', align: 'right', render: (r) => (<span className={r.expected_profit_impact < 0 ? 'text-error' : 'text-emerald-600'}>{formatCurrency(r.expected_profit_impact)}</span>) },
            { key: 'reason', header: 'Reason' },
            { key: 'actions', header: '', align: 'right', render: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" icon="check" loading={approveOne.isPending} onClick={() => approveOne.mutate(r.recommendation_id)}>Approve</Button>
                <Button variant="danger" size="sm" icon="close" loading={reject.isPending} onClick={() => reject.mutate(r.recommendation_id)}>Reject</Button>
              </div>
            ) }
          ]}
          rows={filtered}
          rowKey="recommendation_id"
          emptyMessage={data.isEmpty ? 'No pending recommendations right now.' : `No recommendations match "${search}".`}
        />
      )}
    </section>
  );
}

function RecommendationHistory() {
  const { data, isLoading, isError, error, refetch } = usePriceGuardRecommendationHistory();
  const [search, setSearch] = useState('');
  const history = data?.recommendations || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.trim().toLowerCase();
    return history.filter((r) => r.product_name.toLowerCase().includes(q) || r.product_sku.toLowerCase().includes(q));
  }, [history, search]);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[15px] font-semibold text-on-surface">Recommendation History</h3>
        <div className="relative w-56">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history…" className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" />
        </div>
      </div>

      {isError && <ErrorState compact error={error} onRetry={refetch} />}
      {isLoading && <SkeletonRows rows={5} cols={7} />}

      {data && !isError && (
        <DataTable
          columns={[
            { key: 'product_name', header: 'Product / SKU', render: (r) => (<div><p className="font-medium text-on-surface">{r.product_name}</p><p className="text-[11px] text-secondary font-mono">{r.product_sku}</p></div>) },
            { key: 'action_type', header: 'Action', render: (r) => r.action_type?.replace('_', ' ') },
            { key: 'current_price', header: 'Current', align: 'right', render: (r) => formatCurrency(r.current_price) },
            { key: 'recommended_price', header: 'Recommended', align: 'right', render: (r) => formatCurrency(r.recommended_price) },
            { key: 'expected_profit_impact', header: 'Exp. Impact', align: 'right', render: (r) => (<span className={r.expected_profit_impact < 0 ? 'text-error' : 'text-emerald-600'}>{formatCurrency(r.expected_profit_impact)}</span>) },
            { key: 'status', header: 'Status', render: (r) => <StatusChip tone={STATUS_TONE[r.status] || 'muted'}>{r.status}</StatusChip> },
            { key: 'updated_at', header: 'Updated', render: (r) => (r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—') }
          ]}
          rows={filtered}
          rowKey="recommendation_id"
          emptyMessage={data.isEmpty ? 'No recommendation history yet.' : `No history matches "${search}".`}
        />
      )}
    </section>
  );
}
