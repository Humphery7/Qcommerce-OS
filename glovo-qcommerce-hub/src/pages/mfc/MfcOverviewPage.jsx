import { useState } from 'react';
import TopNav from '../../components/layout/TopNav';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import { LoadingPanel } from '../../components/ui/LoadingState';
import AvailabilityTrendChart from '../../components/mfc/AvailabilityTrendChart';
import PeriodToggle from '../../components/mfc/PeriodToggle';
import OrdersSummaryPanel from '../../components/mfc/OrdersSummaryPanel';
import ListedEfficientSkuPanel from '../../components/mfc/ListedEfficientSkuPanel';
import CategorySalesPanel from '../../components/mfc/CategorySalesPanel';
import ProductSalesPanel from '../../components/mfc/ProductSalesPanel';
import AiInsightsHub from '../../components/mfc/insights/AiInsightsHub';
import { MFC_TABS } from './mfcTabs';
import {
  useDashboardData,
  useMfcOrders,
  useMfcCategorySalesReport,
  useMfcProductSalesReport,
  useMfcProductThresholdReport,
  useRunSnapshotNow
} from '../../api/mfc';
import { WORKSPACES } from '../../app/workspaces';

const workspace = WORKSPACES.mfc;

const STORE_OPTIONS = [
  { value: 'overall', label: 'Overall' },
  { value: 'losf1', label: 'LOSF1' },
  { value: 'mnlf1', label: 'MNLF1' }
];

function Section({ title, subtitle, actions, children }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap min-h-[28px]">
        <div>
          <h3 className="text-[14px] font-semibold text-on-surface">{title}</h3>
          {subtitle && <p className="text-[11px] text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function MfcOverviewPage() {
  const [ordersPeriod, setOrdersPeriod] = useState('weekly');
  const [skuPeriod, setSkuPeriod] = useState('weekly');
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [categoryStore, setCategoryStore] = useState('overall');
  const [productStore, setProductStore] = useState('overall');

  const dashboardQuery = useDashboardData();
  const ordersQuery = useMfcOrders();
  const categoryQuery = useMfcCategorySalesReport();
  const productQuery = useMfcProductSalesReport();
  const thresholdQuery = useMfcProductThresholdReport();
  const runSnapshot = useRunSnapshotNow();

  const isLoading =
    dashboardQuery.isLoading || ordersQuery.isLoading || categoryQuery.isLoading || productQuery.isLoading || thresholdQuery.isLoading;
  const firstError = [dashboardQuery, ordersQuery, categoryQuery, productQuery, thresholdQuery].find((q) => q.isError);

  const trendData =
    trendPeriod === 'monthly' ? dashboardQuery.data?.availabilityTrend : dashboardQuery.data?.availabilityWeeklyTrend;

  return (
    <>
      <TopNav
        title="MFC"
        breadcrumb={[{ label: 'Workspaces' }, { label: 'Micro-fulfillment Center' }]}
        tabs={MFC_TABS}
        actions={
          <div className="flex items-center gap-2">
            <AiInsightsHub />
            <Button
              variant="secondary"
              size="sm"
              icon="sync"
              loading={runSnapshot.isPending}
              onClick={() => runSnapshot.mutate()}
            >
              {runSnapshot.isPending ? 'Refreshing\u2026' : 'Refresh Snapshot'}
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-7xl">
          {runSnapshot.isSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px]">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Snapshot refreshed.
            </div>
          )}
          {runSnapshot.isError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-error text-[12px]">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {runSnapshot.error?.message || 'The snapshot refresh failed.'}
            </div>
          )}

          {firstError && <ErrorState error={firstError.error} onRetry={firstError.refetch} />}
          {isLoading && !firstError && <LoadingPanel message={'Loading MFC workspace data\u2026'} />}

          {!isLoading && !firstError && (
            <>
              <Section
                title="Orders"
                subtitle="Yesterday, current period, run rate, and growth."
                actions={<PeriodToggle value={ordersPeriod} onChange={setOrdersPeriod} />}
              >
                <OrdersSummaryPanel orders={ordersQuery.data?.orders} period={ordersPeriod} />
              </Section>

              <Section
                title="Listed Efficient SKUs"
                subtitle='Listed = threshold status is "Yes" or "No". Efficient = "Yes".'
                actions={<PeriodToggle value={skuPeriod} onChange={setSkuPeriod} />}
              >
                <ListedEfficientSkuPanel products={thresholdQuery.data?.products} period={skuPeriod} />
              </Section>

              <Section
                title="Availability Trend"
                subtitle="UltraFresh vs. LOSF1 vs. MNLF1 over time."
                actions={<PeriodToggle value={trendPeriod} onChange={setTrendPeriod} />}
              >
                <AvailabilityTrendChart data={trendData} />
              </Section>

              <Section
                title="Category Sales"
                subtitle="This week delivered volume by category."
                actions={<PeriodToggle value={categoryStore} onChange={setCategoryStore} options={STORE_OPTIONS} />}
              >
                <CategorySalesPanel categories={categoryQuery.data?.categories} store={categoryStore} />
              </Section>
              <Section
                title="Product Sales"
                subtitle="This week delivered volume by product."
                actions={<PeriodToggle value={productStore} onChange={setProductStore} options={STORE_OPTIONS} />}
              >
                <ProductSalesPanel products={productQuery.data?.products} store={productStore} />
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
