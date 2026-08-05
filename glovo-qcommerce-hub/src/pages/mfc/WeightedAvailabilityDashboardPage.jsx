import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWeightedAvailabilityDashboardData } from '../../api/mfc';
import { SkeletonKpiRow, SkeletonRows } from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import KpiCard from '../../components/ui/KpiCard';
import DataTable from '../../components/ui/DataTable';
import AvailabilityCard from '../../components/mfc/AvailabilityCard';
import AvailabilityTrendChart from '../../components/mfc/AvailabilityTrendChart';
import ComparisonBarChart from '../../components/charts/ComparisonBarChart';

function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
}
function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function formatCompact(v) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

const PAGE_SIZE = 150;

const FILL_TABS = [
  { key: 'current', monthly: 'Current', weekly: 'Current' },
  { key: 'lastMonth', monthly: 'Last Month', weekly: 'Last Week' },
  { key: 'twoMonthsAgo', monthly: 'Last 2 Months', weekly: 'Last 2 Weeks' },
];

export default function WeightedAvailabilityDashboardPage() {
  const [period, setPeriod] = useState('monthly');
  const [fillTab, setFillTab] = useState('current');
  const [lossSearch, setLossSearch] = useState('');
  const [lossPage, setLossPage] = useState(0);
  const { data, isLoading, isError, error, refetch, isFetching } = useWeightedAvailabilityDashboardData();

  const filteredLoss = useMemo(() => {
    const rows = data?.productAvailabilityLoss || [];
    if (!lossSearch.trim()) return rows;
    const q = lossSearch.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [data, lossSearch]);

  const lossTotalPages = Math.ceil(filteredLoss.length / PAGE_SIZE);
  const lossStart = lossPage * PAGE_SIZE;
  const lossEnd = Math.min(lossStart + PAGE_SIZE, filteredLoss.length);
  const pagedLoss = filteredLoss.slice(lossStart, lossEnd);

  function handleLossSearch(val) {
    setLossSearch(val);
    setLossPage(0);
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[16px] font-semibold text-on-surface">Dashboard</h2>
          {data?.summary?.lastUpdated && (
            <p className="text-[11px] text-secondary mt-0.5">
              Last Updated: {new Date(data.summary.lastUpdated).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5">
          {[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'This Week' }].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                period === opt.value
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <div className="space-y-4">
          <SkeletonKpiRow count={3} />
          <SkeletonKpiRow count={5} />
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5">
            <SkeletonRows rows={6} cols={3} />
          </div>
        </div>
      )}

      {data && !isError && (
        <>
          {isFetching && !isLoading && (
            <div className="text-[11px] text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              {'Refreshing…'}
            </div>
          )}

          {/* ── Availability cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AvailabilityCard label="Weighted Availability" data={data.ultrafreshAvailabilityCard?.[period]} />
            <AvailabilityCard label="LOSF1 Availability" data={data.losf1AvailabilityCard?.[period]} />
            <AvailabilityCard label="MNLF1 Availability" data={data.mnlf1AvailabilityCard?.[period]} />
          </div>

          {/* ── KPI summary ── */}
          {(() => {
            const s = period === 'monthly' ? data.summary : data.summaryWeekly;
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total Suppliers" value={formatNumber(s?.totalSuppliers)} icon="factory" />
                <KpiCard label="Products Assigned" value={formatNumber(s?.totalProducts)} icon="inventory_2" />
                <KpiCard label="Qty Ordered" value={formatNumber(s?.totalQuantityOrdered)} icon="shopping_cart" />
                <KpiCard label="Qty Received" value={formatNumber(s?.totalQuantityReceived)} icon="move_to_inbox" />
                <KpiCard label="Overall Fill Rate" value={formatPercent(s?.overallFillRate)} icon="percent" critical={(s?.overallFillRate || 0) < 0.8} />
              </div>
            );
          })()}

          {/* ── Availability Trend ── */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
            <h3 className="text-[14px] font-semibold text-on-surface">
              {period === 'monthly' ? 'Availability Trend by Month' : 'Availability Trend by Week'}
            </h3>
            <p className="text-[11px] text-secondary mt-0.5 mb-3">
              Weighted vs. LOSF1 vs. MNLF1 Availability
            </p>
            <AvailabilityTrendChart
              data={period === 'monthly' ? data.availabilityTrend : data.availabilityWeeklyTrend}
            />
          </section>

          {/* ── Top 10 Suppliers by Ordered Quantity (grouped bar) ── */}
          {(() => {
            const rows = (period === 'monthly' ? data.topSuppliersByQuantity : data.topSuppliersByQuantityWeekly) || [];
            return (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                <h3 className="text-[14px] font-semibold text-on-surface">
                  Top 10 Suppliers By Ordered Quantity
                </h3>
                <p className="text-[11px] text-secondary mt-0.5 mb-3">Ordered vs. Received quantity</p>
                {rows.length === 0 ? (
                  <p className="text-[12px] text-secondary py-4 text-center">No supplier data available yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 44)}>
                    <BarChart
                      data={rows}
                      layout="vertical"
                      margin={{ top: 4, right: 64, left: 4, bottom: 4 }}
                      barCategoryGap="30%"
                      barGap={3}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={false} vertical />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatCompact}
                      />
                      <YAxis
                        type="category"
                        dataKey="supplierName"
                        tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                        axisLine={false}
                        tickLine={false}
                        width={152}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatNumber(value), name]}
                        contentStyle={{ borderRadius: 6, border: '1px solid var(--outline-variant)', fontSize: 12, background: 'var(--surface-container-lowest)', color: 'var(--on-surface)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey="quantityOrdered" name="Ordered" fill="#375aa5" maxBarSize={13} radius={[0, 3, 3, 0]}>
                        <LabelList dataKey="quantityOrdered" position="right" formatter={formatNumber} style={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 500 }} />
                      </Bar>
                      <Bar dataKey="quantityReceived" name="Received" fill="#374151" maxBarSize={13} radius={[0, 3, 3, 0]}>
                        <LabelList dataKey="quantityReceived" position="right" formatter={formatNumber} style={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 500 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </section>
            );
          })()}

          {/* ── Supplier Fill Rate (tabbed) ── */}
          {(() => {
            const metrics = (period === 'monthly' ? data.supplierMonthlyMetrics : data.supplierWeeklyMetrics) || [];
            const mode = period === 'monthly' ? 'monthly' : 'weekly';
            const chartData = metrics
              .map((r) => ({
                label: r.supplierName,
                value: +((r[fillTab]?.fillRate || 0)).toFixed(1),
                color: (r[fillTab]?.fillRate || 0) < 40 ? '#d92d20' : '#16a34a',
              }))
              .sort((a, b) => b.value - a.value);
            return (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                  <h3 className="text-[14px] font-semibold text-on-surface">Supplier Fill Rate</h3>
                  <div className="flex items-center gap-1">
                    {FILL_TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setFillTab(t.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          fillTab === t.key
                            ? 'bg-accent-container text-on-accent-container'
                            : 'text-secondary hover:bg-surface-container'
                        }`}
                      >
                        {t[mode]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-secondary mb-3">
                  {`By fill rate — ${FILL_TABS.find((t) => t.key === fillTab)?.[mode]}`}
                </p>
                <ComparisonBarChart
                  data={chartData}
                  layout="horizontal"
                  height={Math.max(200, chartData.length * 34)}
                  valueFormatter={(v) => `${v}%`}
                />
              </section>
            );
          })()}

          {/* ── Product Availability Loss ── */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-[14px] font-semibold text-on-surface">Product Availability Loss</h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-secondary shrink-0">
                  {filteredLoss.length} of {data.productAvailabilityLoss?.length || 0} products
                </span>
                <div className="relative w-48">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[14px]">search</span>
                  <input
                    value={lossSearch}
                    onChange={(e) => handleLossSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full bg-surface-container border border-outline-variant rounded-md pl-7 pr-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                  />
                </div>
              </div>
            </div>
            <DataTable
              columns={[
                { key: 'sku', header: 'SKU', mono: true, sortable: true },
                { key: 'name', header: 'Name', sortable: true },
                { key: 'availability', header: 'Availability', align: 'right', sortable: true, render: (r) => (
                  <span className={(r.availability || 0) < 0.8 ? 'text-error font-semibold' : ''}>{formatPercent(r.availability)}</span>
                )},
                { key: 'availabilityLoss', header: 'Availability Loss', align: 'right', sortable: true, render: (r) => (
                  <span className="text-error font-semibold">{formatPercent(r.availabilityLoss)}</span>
                )},
              ]}
              rows={pagedLoss}
              rowKey="sku"
              emptyMessage={lossSearch ? `No products match "${lossSearch}".` : 'No availability loss recorded — nice.'}
            />
            {lossTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
                <span className="text-[11px] text-secondary">
                  Showing {lossStart + 1}{' – '}{lossEnd} of {filteredLoss.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLossPage((p) => p - 1)}
                    disabled={lossPage === 0}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    Prev
                  </button>
                  <span className="text-[11px] text-secondary px-2">{lossPage + 1} / {lossTotalPages}</span>
                  <button
                    onClick={() => setLossPage((p) => p + 1)}
                    disabled={lossPage >= lossTotalPages - 1}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </section>

        </>
      )}
    </div>
  );
}
