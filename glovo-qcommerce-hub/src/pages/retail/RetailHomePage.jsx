import TopNav from '../../components/layout/TopNav';
import MetricCard from '../../components/ui/MetricCard';
import LiveBadge from '../../components/ui/LiveBadge';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonKpiRow } from '../../components/ui/LoadingState';
import TrendAreaChart from '../../components/charts/TrendAreaChart';
import ComparisonBarChart from '../../components/charts/ComparisonBarChart';
import { RETAIL_TABS } from './retailTabs';
import { useRetailHomeMetrics } from '../../api/retail';
import { WORKSPACES } from '../../app/workspaces';

const workspace = WORKSPACES.retail;

function formatNumber(n) { return new Intl.NumberFormat('en-US').format(Math.round(n || 0)); }

export default function RetailHomePage() {
  const { data, isLoading, isError, error, refetch } = useRetailHomeMetrics();

  return (
    <>
      <TopNav title="Retail" breadcrumb={[{ label: 'Workspaces' }, { label: workspace.fullLabel }]} tabs={RETAIL_TABS} />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-7xl">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-surface-container flex items-center justify-center border border-outline-variant">
                <span className="material-symbols-outlined text-[18px] text-secondary">{workspace.icon}</span>
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-on-surface">Retail Workspace</h2>
                <p className="text-[11px] text-secondary">Pharmacy and retail catalog health, partner CDTP, and weekly order volume across ABV and beyond.</p>
              </div>
            </div>
          </div>

          {isError && <ErrorState error={error} onRetry={refetch} />}

          {isLoading && (
            <div className="space-y-4">
              <SkeletonKpiRow count={4} />
              <SkeletonKpiRow count={3} />
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon="shopping_cart" label="Orders" value={formatNumber(data.orders.value)} unit={data.orders.unitLabel} deltas={data.orders.deltas} trend={data.orders.trend} badge={<LiveBadge />} footnote="Live order count arrives with BigQuery" />
                <MetricCard icon="calendar_view_week" label="Weekly Retail Orders" value={formatNumber(data.weeklyRetailOrders.value)} unit={data.weeklyRetailOrders.unit} deltas={data.weeklyRetailOrders.deltas} trend={data.weeklyRetailOrders.trend} />
                <MetricCard icon="medication" label="Pharmacy Available SKUs" value={formatNumber(data.pharmacyAvailableSkus.value)} unit={`/ ${formatNumber(data.pharmacyAvailableSkus.total)}`} deltas={data.pharmacyAvailableSkus.deltas} />
                <MetricCard icon="storefront" label="Pharmacy Activations (ABV)" value={formatNumber(data.pharmacyActivationsAbv.value)} unit={data.pharmacyActivationsAbv.unit} deltas={data.pharmacyActivationsAbv.deltas} />
                <MetricCard icon="inventory_2" label="Retail Available SKUs" value={formatNumber(data.retailAvailableSkus.value)} unit={`/ ${formatNumber(data.retailAvailableSkus.total)}`} deltas={data.retailAvailableSkus.deltas} />
                <MetricCard icon="local_pharmacy" label="MedPlus SKUs" value={formatNumber(data.medPlusSkus.value)} unit={`/ ${formatNumber(data.medPlusSkus.total)}`} deltas={data.medPlusSkus.deltas} />
                <MetricCard icon="local_shipping" label="Retail CDTP" value={data.retailCdtp.value.toFixed(1)} unit={data.retailCdtp.unit} deltas={data.retailCdtp.deltas} />
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                  <h3 className="text-[14px] font-semibold text-on-surface mb-3">Orders Trend — This Week</h3>
                  <TrendAreaChart data={data.ordersTrend} series={[{ key: 'orders', name: 'Orders', color: '#375aa5' }]} valueFormatter={formatNumber} />
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card flex flex-col">
                  <h3 className="text-[14px] font-semibold text-on-surface mb-3">CDTP by Partner</h3>
                  <div className="flex-1 flex items-center">
                    <ComparisonBarChart data={data.cdtpByPartner} layout="horizontal" height={160} valueFormatter={(v) => `${v}m`} />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
