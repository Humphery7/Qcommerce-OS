import { useMemo, useState } from 'react';
import {
  usePriceGuardDashboardSummary,
  usePriceGuardProducts,
  usePriceGuardAlerts,
  useRunPriceGuardSnapshotNow
} from '../../../api/priceGuard';
import { SkeletonKpiRow, SkeletonRows } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import StatusChip from '../../../components/ui/StatusChip';
import Button from '../../../components/ui/Button';
import PricingMetricsChart from '../../../components/charts/PricingMetricsChart';
import AvailabilityCard from '../../../components/mfc/AvailabilityCard';
import { PRICE_GUARD_ACCENT } from './priceGuardNav';

const MARGIN_PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'This Week' }
];

// Side-by-side segmented toggle (same visual pattern Ultrafresh's own
// Dashboard uses for its Monthly/This Week switch) rather than the shared
// PeriodToggle dropdown, which stays a <select> everywhere else it's used.
function SegmentedToggle({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-surface-container-lowest text-on-surface shadow-sm'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Turns the flat avg_margin_this_/last_{month,week}[_losf1|_mnlf1] fields
// from getPriceGuardDashboardSummary into the {hasData, latestValue,
// latestLabel, direction, percentChange, prior} shape AvailabilityCard
// already knows how to render (same component Ultrafresh's Dashboard uses).
// A prior value of 0 is treated as "no history yet" rather than a real
// zero-margin baseline, so a fresh field doesn't render a misleading jump.
function buildMarginCardData(summary, periodWord, suffix) {
  const current = summary?.[`avg_margin_this_${periodWord}${suffix}`];
  if (!current) return { hasData: false };

  const prior = summary?.[`avg_margin_last_${periodWord}${suffix}`];
  const hasPrior = Boolean(prior);
  const percentChange = hasPrior ? current - prior : null;
  const direction = !hasPrior ? 'flat' : percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'flat';
  const priorLabel = periodWord === 'month' ? 'Last Month' : 'Last Week';

  return {
    hasData: true,
    latestValue: current,
    latestLabel: periodWord === 'month' ? 'This Month' : 'This Week',
    direction,
    percentChange,
    prior: hasPrior ? [{ label: priorLabel, value: prior }] : []
  };
}

function formatCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
}
function formatCompactCurrency(n) {
  return `₦${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)}`;
}
function formatPercent(n) {
  return `${((n || 0) * 100).toFixed(1)}%`;
}
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function KpiCard({ label, value, valueColor, footer }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col items-center text-center gap-2 shadow-card">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
      <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: valueColor }}>{value}</span>
      {footer}
    </div>
  );
}

export default function PriceGuardDashboardPage() {
  // Deliberately NOT using getPriceGuardDashboardData here — that endpoint
  // is a heavy all-in-one bundle (products+alerts+matches+suppliers+
  // categories+settings), and this page only ever needed a KPI summary, a
  // top-15 products slice, and the critical alerts. Composing the page from
  // the same lightweight, per-feature hooks the other pages use means
  // React Query dedupes identical calls (e.g. products) across pages
  // instead of this page paying for the full combined payload on its own.
  const summaryQuery = usePriceGuardDashboardSummary();
  const productsQuery = usePriceGuardProducts();
  const criticalAlertsQuery = usePriceGuardAlerts({ severity: 'critical' });
  const runSnapshot = useRunPriceGuardSnapshotNow();
  const [marginPeriod, setMarginPeriod] = useState('monthly');
  const marginPeriodWord = marginPeriod === 'monthly' ? 'month' : 'week';

  const isLoading = summaryQuery.isLoading || productsQuery.isLoading || criticalAlertsQuery.isLoading;
  const firstError = [summaryQuery, productsQuery, criticalAlertsQuery].find((q) => q.isError);
  const ready = summaryQuery.data && productsQuery.data && criticalAlertsQuery.data;

  const summary = summaryQuery.data?.summary;

  const chartData = useMemo(() => {
    const products = productsQuery.data?.products || [];
    return [...products]
      .sort((a, b) => (b.revenue_latest || 0) - (a.revenue_latest || 0))
      .slice(0, 15)
      .map((p) => ({
        label: truncate(p.product_name, 16),
        revenue: +((p.revenue_latest || 0) / 1000).toFixed(1),
        margin: +((p.margin_today || 0) * 100).toFixed(1)
      }));
  }, [productsQuery.data]);

  const criticalActions = useMemo(() => {
    const alerts = criticalAlertsQuery.data?.alerts || [];
    return [...alerts]
      .sort((a, b) => (b.revenue_latest || 0) - (a.revenue_latest || 0))
      .slice(0, 6);
  }, [criticalAlertsQuery.data]);

  // summary.alerts is a {green,yellow,orange,red,critical} breakdown across
  // the whole catalog, not the alert queue itself — green means healthy, so
  // it's excluded from the "N ALERTS" badge.
  const alertCount = summary
    ? (summary.alerts?.yellow || 0) + (summary.alerts?.orange || 0) + (summary.alerts?.red || 0) + (summary.alerts?.critical || 0)
    : 0;

  return (
    <div className="px-5 py-4 space-y-4 max-w-7xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] font-bold text-on-surface">Executive Pricing Summary</h1>
          <p className="text-[12px] text-secondary mt-0.5">Cross-competitor metrics and potential profit index tracking</p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon="sync"
          loading={runSnapshot.isPending}
          onClick={() => runSnapshot.mutate()}
          className="shrink-0"
          style={{ background: PRICE_GUARD_ACCENT, color: '#ffffff' }}
        >
          {runSnapshot.isPending ? 'Syncing…' : 'Run Sync Job'}
        </Button>
      </div>

      {runSnapshot.isSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px]">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Snapshot refreshed.
        </div>
      )}
      {runSnapshot.isError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-error text-[12px]">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {runSnapshot.error?.message || 'The sync job failed.'}
        </div>
      )}

      {firstError && <ErrorState error={firstError.error} onRetry={firstError.refetch} />}

      {isLoading && !firstError && (
        <div className="space-y-4">
          <SkeletonKpiRow count={3} />
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5">
            <SkeletonRows rows={6} cols={3} />
          </div>
        </div>
      )}

      {ready && !firstError && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KpiCard
              label="Total Gross Profit"
              value={formatCurrency(summary?.gross_profit)}
              valueColor="#16a34a"
              footer={<span className="text-[11px] text-secondary">Latest catalog period sales</span>}
            />
            <KpiCard
              label="Revenue at Risk"
              value={formatCurrency(summary?.revenue_at_risk)}
              valueColor="var(--error)"
              footer={<StatusChip tone="critical">{alertCount} ALERTS</StatusChip>}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-on-surface">Margin Performance</h3>
              <SegmentedToggle value={marginPeriod} onChange={setMarginPeriod} options={MARGIN_PERIOD_OPTIONS} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AvailabilityCard label="Overall Margin" data={buildMarginCardData(summary, marginPeriodWord, '')} />
              <AvailabilityCard label="LOSF1 Margin" data={buildMarginCardData(summary, marginPeriodWord, '_losf1')} />
              <AvailabilityCard label="MNLF1 Margin" data={buildMarginCardData(summary, marginPeriodWord, '_mnlf1')} />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
              <h3 className="text-[14px] font-semibold text-on-surface mb-3">Pricing Metrics Breakdown</h3>
              <PricingMetricsChart
                data={chartData}
                barName="Revenue (kN)"
                lineName="Margin %"
                barColor={PRICE_GUARD_ACCENT}
                lineColor="#00A082"
                barValueFormatter={(v) => new Intl.NumberFormat('en-US').format(v)}
                lineValueFormatter={(v) => `${v}%`}
              />
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card flex flex-col gap-3">
              <h3 className="text-[14px] font-semibold text-on-surface">Critical Actions Needed</h3>
              {criticalActions.length === 0 ? (
                <p className="text-[12px] text-secondary py-4 text-center">No critical alerts right now.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {criticalActions.map((a, i) => (
                    <div key={`${a.product_sku}-${i}`} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-error/10 text-error flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[14px]">priority_high</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{a.product_name}</p>
                        <p className="text-[11px] text-secondary">{a.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
