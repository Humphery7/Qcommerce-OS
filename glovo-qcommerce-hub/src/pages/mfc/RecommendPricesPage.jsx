import { useEffect, useMemo, useState } from 'react';
import { useAllPrices, useAddOrUpdatePrice, useDeletePrice } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
}

const PAGE_SIZE = 50;
const emptyForm = { sku: '', productName: '', supplierId: '', supplierName: '', tradePrice: '' };

export default function RecommendPricesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingKey, setEditingKey] = useState(null);
  const [confirmingKey, setConfirmingKey] = useState(null);
  const [formError, setFormError] = useState('');

  const { data, isLoading, isError, error, refetch } = useAllPrices();
  const saveMutation = useAddOrUpdatePrice();
  const deleteMutation = useDeletePrice();

  const filteredPrices = useMemo(() => {
    if (!data?.prices) return [];
    if (!search.trim()) return data.prices;
    const q = search.trim().toLowerCase();
    return data.prices.filter(
      (p) => p.sku.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
    );
  }, [data, search]);

  useEffect(() => { setPage(1); }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filteredPrices.length / PAGE_SIZE));
  const pagedPrices = filteredPrices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAddModal = () => { setForm(emptyForm); setEditingKey(null); setFormError(''); setModalOpen(true); };
  const openEditModal = (price) => {
    setForm({ sku: price.sku, productName: price.productName, supplierId: price.supplierId, supplierName: price.supplierName, tradePrice: String(price.tradePrice) });
    setEditingKey(`${price.sku}::${price.supplierId}`);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.sku.trim() || !form.supplierId.trim()) { setFormError('SKU and Supplier ID are required.'); return; }
    try {
      await saveMutation.mutateAsync({ sku: form.sku.trim(), productName: form.productName.trim(), supplierId: form.supplierId.trim(), supplierName: form.supplierName.trim(), tradePrice: parseFloat(form.tradePrice) || 0 });
      setModalOpen(false);
    } catch (err) { setFormError(err.message || 'Failed to save this price.'); }
  };

  const handleDelete = async (price) => {
    const key = `${price.sku}::${price.supplierId}`;
    if (confirmingKey !== key) { setConfirmingKey(key); return; }
    setConfirmingKey(null);
    await deleteMutation.mutateAsync({ sku: price.sku, supplierId: price.supplierId });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-on-surface">Recommend Prices</h2>
          <Button variant="primary" size="md" icon="add" onClick={openAddModal}>Add Price</Button>
        </div>

        {isLoading && <LoadingPanel message={'Loading supplier prices\u2026'} />}
        {isError && <ErrorState error={error} onRetry={refetch} />}

        {data && !isError && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-on-surface">Supplier Prices ({filteredPrices.length})</h3>
                {filteredPrices.length !== data.prices.length && (
                  <span className="text-[11px] text-secondary">of {data.prices.length} total</span>
                )}
              </div>
              <div className="relative w-56">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SKU, product, or supplier..."
                  className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
              </div>
            </div>

            <DataTable
              columns={[
                { key: 'sku', header: 'SKU', mono: true, sortable: true },
                { key: 'productName', header: 'Product', sortable: true },
                { key: 'supplierName', header: 'Supplier', sortable: true },
                { key: 'supplierId', header: 'Supplier ID', mono: true },
                { key: 'tradePrice', header: 'Trade Price', align: 'right', mono: true, sortable: true, render: (r) => formatCurrency(r.tradePrice) },
                { key: 'actions', header: '', align: 'right', render: (r) => { const key = `${r.sku}::${r.supplierId}`; const confirming = confirmingKey === key; return (<div className="flex justify-end gap-1"><Button variant="ghost" size="sm" icon="edit" onClick={() => openEditModal(r)}>Edit</Button><Button variant={confirming ? 'danger' : 'ghost'} size="sm" icon={confirming ? 'check' : 'delete'} loading={deleteMutation.isPending && confirmingKey === null} onClick={() => handleDelete(r)} onBlur={() => setConfirmingKey((k) => (k === key ? null : k))}>{confirming ? 'Confirm' : 'Delete'}</Button></div>); } }
              ]}
              rows={pagedPrices}
              rowKey="sku"
              emptyMessage={search ? `No prices match "${search}".` : 'No supplier prices yet \u2014 add one to start generating recommendations.'}
            />

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
                <span className="text-[11px] text-secondary">
                  Showing {(page - 1) * PAGE_SIZE + 1}{' \u2013 '}{Math.min(page * PAGE_SIZE, filteredPrices.length)} of {filteredPrices.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="sm" icon="chevron_left" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <span className="text-[11px] text-secondary px-2">{page} / {totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next<span className="material-symbols-outlined text-[15px] ml-0.5">chevron_right</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingKey ? 'Edit Supplier Price' : 'Add Supplier Price'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleSubmit} loading={saveMutation.isPending}>{editingKey ? 'Save Changes' : 'Add Price'}</Button></>}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {formError && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/10 text-error text-[12px]"><span className="material-symbols-outlined text-[16px]">error</span>{formError}</div>)}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">SKU</span><input required disabled={Boolean(editingKey)} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 disabled:opacity-60 transition-all" /></label>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Supplier ID</span><input required disabled={Boolean(editingKey)} value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 disabled:opacity-60 transition-all" /></label>
          </div>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Product Name</span><input value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Supplier Name</span><input value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-on-surface">Trade Price</span><input type="number" step="0.01" min="0" required value={form.tradePrice} onChange={(e) => setForm((f) => ({ ...f, tradePrice: e.target.value }))} className="bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all" /></label>
        </form>
      </Modal>
    </>
  );
}
