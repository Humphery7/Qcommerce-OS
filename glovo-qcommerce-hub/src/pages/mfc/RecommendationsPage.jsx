import { useEffect, useMemo, useState } from 'react';
import { useRecommendations } from '../../api/mfc';
import { LoadingPanel } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import clsx from 'clsx';

const PAGE_SIZE = 10;

function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

const RANK_BADGE = {
  1: 'bg-accent-container text-on-accent-container',
  2: 'bg-surface-container text-secondary',
  3: 'bg-surface-container text-secondary'
};

function SupplierRankRow({ supplier }) {
  return (
    <div className={clsx('flex items-center gap-3 p-2.5 rounded-md border', supplier.rank === 1 ? 'bg-accent-container/5 border-accent-container/20' : 'bg-surface-container border-outline-variant/50')}>
      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[11px] shrink-0', RANK_BADGE[supplier.rank] || RANK_BADGE[3])}>
        {supplier.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[13px] text-on-surface truncate">{supplier.supplierName}</p>
        <p className="text-[11px] text-secondary">Product fill {formatPercent(supplier.productFillRate)}{' \u00B7 '}Overall fill {formatPercent(supplier.overallFillRate)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[12px] font-semibold text-on-surface">{formatCurrency(supplier.tradePrice)}</p>
        <p className="text-[11px] text-secondary">score {supplier.score.toFixed(2)}</p>
      </div>
    </div>
  );
}

function UpdatePricesModal({ product, onClose }) {
  if (!product) return null;
  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={`Update Prices \u2014 ${product.productName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onClose}>Save Changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[12px]">
          <span className="material-symbols-outlined text-[16px]">construction</span>
          Editing here is not wired up yet — manage live prices from Recommend Prices.
        </div>
        {product.suppliers.map((s) => (
          <div key={s.supplierId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[12px] text-on-surface truncate">{s.supplierName}</p>
              <p className="text-[11px] text-secondary truncate">{s.supplierId}</p>
            </div>
            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[12px]">$</span>
              <input disabled defaultValue={s.tradePrice.toFixed(2)} className="w-full bg-surface-container border border-outline-variant rounded-md pl-5 pr-2.5 py-1 text-[12px] font-mono disabled:opacity-70" />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function RecommendationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState(null);
  const { data, isLoading, isError, error, refetch } = useRecommendations();

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    if (!search.trim()) return data.products;
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [data, search]);

  useEffect(() => { setPage(1); }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[16px] font-semibold text-on-surface">Recommendations</h2>
          <div className="relative w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
            />
          </div>
        </div>

        {isLoading && <LoadingPanel message={'Loading recommendations\u2026'} />}
        {isError && <ErrorState error={error} onRetry={refetch} />}

        {data && !isError && (
          <>
            <p className="text-[12px] text-secondary">Top 3 suppliers per product, blending product fill rate, overall fill rate, and price.{data.lastUpdated && <> Last refreshed {new Date(data.lastUpdated).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.</>}</p>

            {data.isEmpty || filteredProducts.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
                <EmptyState icon="trending_up" message={data.isEmpty ? 'No recommendations yet \u2014 add supplier prices to generate them.' : `No products match "${search}".`} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {pagedProducts.map((product) => (
                    <div key={product.sku} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 flex flex-col gap-3 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-secondary">{product.sku}</p>
                          <h3 className="text-[14px] font-semibold text-on-surface truncate">{product.productName}</h3>
                        </div>
                        <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditingProduct(product)}>Update Prices</Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {product.suppliers.map((s) => (<SupplierRankRow key={s.supplierId} supplier={s} />))}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-secondary">Showing {(page - 1) * PAGE_SIZE + 1}{' \u2013 '}{Math.min(page * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products</p>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" icon="chevron_left" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                      <span className="text-[11px] text-secondary px-1">Page {page} of {totalPages}</span>
                      <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <UpdatePricesModal product={editingProduct} onClose={() => setEditingProduct(null)} />
    </>
  );
}
