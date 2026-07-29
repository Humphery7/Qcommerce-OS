import TopNav from '../../components/layout/TopNav';
import MetricCard from '../../components/ui/MetricCard';
import LiveBadge from '../../components/ui/LiveBadge';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonKpiRow } from '../../components/ui/LoadingState';
import TrendAreaChart from '../../components/charts/TrendAreaChart';
import DonutBreakdown from '../../components/charts/DonutBreakdown';
import ComparisonBarChart from '../../components/charts/ComparisonBarChart';
import { GROCERIES_TABS } from './groceriesTabs';
import { useGroceriesHomeMetrics } from '../../api/groceries';
import { WORKSPACES } from '../../app/workspaces';

const workspace = WORKSPACES.groceries;

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }

export default function GroceriesHomePage() {
  const { data, isLoading, isError, error, refetch } = useGroceriesHomeMetrics();

  return (
    <>
      <TopNav title="Groceries" breadcrumb={[{ label: 'Workspaces' }, { label: workspace.fullLabel }]} tabs={GROCERIES_TABS} />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-7xl">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-surface-container flex items-center justify-center border border-outline-variant">
                <span className="material-symbols-outlined text-[18px] text-secondary">{workspace.icon}</span>
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-on-surface">Groceries Workspace</h2>
                <p className="text-[11px] text-secondary">Fresh market performance — availability across SPAR and Market Square, picker operations, and account health.</p>
              </div>
            </div>
          </div>

          {isError && <ErrorState error={error} onRetry={refetch} />}

          {isLoading && (
            <div className="space-y-4">
              <SkeletonKpiRow count={4} />
              <SkeletonKpiRow count={4} />
              <SkeletonKpiRow count={3} />
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon="shopping_cart" label="Orders" value={formatNumber(data.orders.value)} unit={data.orders.unitLabel} deltas={data.orders.deltas} trend={data.orders.trend} badge={<LiveBadge />} footnote="Live order count arrives with BigQuery" />
                <MetricCard icon="percent" label="%IND" value={data.percentInd.value.toFixed(1)} unit={data.percentInd.unit} deltas={data.percentInd.deltas} />
                <MetricCard icon="inventory_2" label="Available SKUs (SPAR)" value={formatNumber(data.availableSkusSpar.value)} unit={`/ ${formatNumber(data.availableSkusSpar.total)}`} deltas={data.availableSkusSpar.deltas} />
                <MetricCard icon="inventory_2" label="Available SKUs (MSQ)" value={formatNumber(data.availableSkusMsq.value)} unit={`/ ${formatNumber(data.availableSkusMsq.total)}`} deltas={data.availableSkusMsq.deltas} />
                <MetricCard icon="timer" label="Prep Time" value={data.prepTime.value.toFixed(1)} unit={data.prepTime.unit} deltas={data.prepTime.deltas} />
                <MetricCard icon="storefront" label="Market Square Prep Time" value={data.marketSquarePrepTime.value.toFixed(1)} unit={data.marketSquarePrepTime.unit} deltas={data.marketSquarePrepTime.deltas} />
                <MetricCard icon="local_shipping" label="Market Square CDTP" value={data.marketSquareCdtp.value.toFixed(1)} unit={data.marketSquareCdtp.unit} deltas={data.marketSquareCdtp.deltas} />
                <MetricCard icon="autorenew" label="% Replacement Top Accounts" value={data.replacementTopAccounts.value.toFixed(1)} unit={data.replacementTopAccounts.unit} deltas={data.replacementTopAccounts.deltas} />
                <MetricCard icon="report" label="% Bad Performing Pickers" value={data.badPerformingPickers.value.toFixed(1)} unit={data.badPerformingPickers.unit} deltas={data.badPerformingPickers.deltas} />
                <MetricCard icon="badge" label="Active Picker Accounts" value={formatNumber(data.activePickerAccounts.value)} unit={data.activePickerAccounts.unit} deltas={data.activePickerAccounts.deltas} />
                <MetricCard icon="groups" label="SAIDs with Picker Accounts" value={formatNumber(data.saidsWithPickerAccounts.value)} unit={data.saidsWithPickerAccounts.unit} deltas={data.saidsWithPickerAccounts.deltas} />
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                  <h3 className="text-[14px] font-semibold text-on-surface mb-3">Prep Time Trend — This Week</h3>
                  <TrendAreaChart data={data.prepTimeTrend} series={[{ key: 'prepTime', name: 'Prep Time', color: '#8a5c00' }, { key: 'marketSquarePrepTime', name: 'Market Square Prep Time', color: '#FFC244' }]} valueFormatter={(v) => `${v} min`} yTickFormatter={(v) => `${v}m`} />
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card flex flex-col">
                  <h3 className="text-[14px] font-semibold text-on-surface mb-3">Picker Accounts</h3>
                  <div className="flex-1 flex items-center">
                    <DonutBreakdown data={data.pickerAccountsBreakdown} centerValue={formatNumber(data.saidsWithPickerAccounts.value)} centerLabel="Total SAIDs" />
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                <h3 className="text-[14px] font-semibold text-on-surface mb-3">Available SKUs by Source</h3>
                <ComparisonBarChart data={data.skuComparison} height={140} layout="horizontal" valueFormatter={formatNumber} />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
