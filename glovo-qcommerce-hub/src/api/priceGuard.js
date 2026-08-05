import { apiGet, apiPost } from './client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../store/useSettingsStore';

const staleTime = 60 * 1000;

function useApiConfigured() {
  return Boolean(useSettingsStore((s) => s.apiBaseUrl));
}

export const priceGuardApi = {
  getDashboardData: () => apiGet('getPriceGuardDashboardData'),
  getDashboardSummary: () => apiGet('getPriceGuardDashboardSummary'),
  getProducts: (params) => apiGet('getPriceGuardProducts', params),
  getCategoryHealth: () => apiGet('getPriceGuardCategoryHealth'),
  getSupplierHealth: () => apiGet('getPriceGuardSupplierHealth'),
  getAlerts: (params) => apiGet('getPriceGuardAlerts', params),
  getMatches: (params) => apiGet('getPriceGuardMatches', params),
  approveMatch: (params) => apiPost('approvePriceGuardMatch', params),
  saveManualOverride: (params) => apiPost('savePriceGuardManualOverride', params),
  triggerRematch: (params) => apiPost('triggerPriceGuardRematch', params),
  getSettings: () => apiGet('getPriceGuardSettings'),
  saveSettings: (settings) => apiPost('savePriceGuardSettings', settings),
  getPendingRecommendations: () => apiGet('getPriceGuardPendingRecommendations'),
  getRecommendationHistory: () => apiGet('getPriceGuardRecommendationHistory'),
  getProductMetrics: (sku) => apiGet('getPriceGuardProductMetrics', { sku }),
  submitRecommendation: (params) => apiPost('submitPriceGuardRecommendation', params),
  approveRecommendation: (id) => apiPost('approvePriceGuardRecommendation', { id }),
  approveRecommendations: (ids) => apiPost('approvePriceGuardRecommendations', { ids }),
  rejectRecommendation: (id) => apiPost('rejectPriceGuardRecommendation', { id }),
  runDailySync: () => apiPost('runPriceGuardDailySync'),
  getPipelineStatus: () => apiGet('getPriceGuardPipelineStatus'),
  runSnapshotNow: () => apiPost('runPriceGuardSnapshotNow')
};

// Fields getPriceGuardProductMetrics returns as raw BigQuery strings (every
// other endpoint already casts these server-side via Utilities_.toNumber()).
const METRIC_NUMBER_FIELDS = [
  'selling_price_today', 'cost_price_today', 'selling_price_last_month', 'cost_price_last_month',
  'margin_today', 'margin_last_month', 'margin_last_2_months', 'quantity_sold_latest',
  'revenue_latest', 'gross_profit_latest', 'gross_profit_last_month', 'market_median_price',
  'price_index', 'competitor_gap', 'competitor_count', 'revenue_at_risk', 'margin_leakage',
  'opportunity_score', 'risk_score', 'avg_margin_latest'
];

function castMetricNumbers(metrics) {
  if (!metrics) return metrics;
  const out = { ...metrics };
  METRIC_NUMBER_FIELDS.forEach((key) => {
    if (out[key] !== undefined && out[key] !== null) out[key] = Number(out[key]);
  });
  return out;
}

const KEY = 'priceGuard';

/** Powers the Price Guard Dashboard page — KPIs, chart, critical actions. */
export function usePriceGuardDashboardData() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'dashboardData'],
    queryFn: priceGuardApi.getDashboardData,
    enabled,
    staleTime: 5 * 60 * 1000 // matches the backend's own 5-min cache
  });
}

export function usePriceGuardDashboardSummary() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'dashboardSummary'],
    queryFn: priceGuardApi.getDashboardSummary,
    enabled,
    staleTime
  });
}

/**
 * Full, unfiltered product snapshot. Products Catalog, Revenue Leakage, and
 * Opportunity Finder all read this same cached query and filter/sort
 * client-side (same convention as ProductForecastPage.jsx) rather than each
 * hitting the endpoint with server-side filters.
 */
export function usePriceGuardProducts() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'products'],
    queryFn: () => priceGuardApi.getProducts(),
    enabled,
    staleTime
  });
}

export function usePriceGuardCategoryHealth() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'categoryHealth'],
    queryFn: priceGuardApi.getCategoryHealth,
    enabled,
    staleTime
  });
}

export function usePriceGuardSupplierHealth() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'supplierHealth'],
    queryFn: priceGuardApi.getSupplierHealth,
    enabled,
    staleTime
  });
}

/** Alerts support real server-side filters (they can genuinely narrow the query). */
export function usePriceGuardAlerts(filters = {}) {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'alerts', filters],
    queryFn: () => priceGuardApi.getAlerts(filters),
    enabled,
    staleTime
  });
}

/** Unfiltered — Match Management filters client-side over this one cached list. */
export function usePriceGuardMatches() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'matches'],
    queryFn: () => priceGuardApi.getMatches(),
    enabled,
    staleTime
  });
}

/**
 * approvePriceGuardMatch/savePriceGuardManualOverride/submitPriceGuardRecommendation
 * (etc.) write to the live tables, but the GET endpoints that power these
 * pages (getPriceGuardMatches, getPriceGuardPendingRecommendations,
 * getPriceGuardRecommendationHistory) read from snapshot tables that only
 * get rebuilt by runPriceGuardSnapshotNow — the API doc calls this out
 * explicitly for matches ("Writes to product_matches, not matches_snapshot
 * — the match queue read won't visibly change from this call alone") and
 * bundles the recommendations pending/history snapshots into the same
 * rebuild. So a plain refetch after a write just re-reads the same stale
 * snapshot; this helper triggers the (fast) snapshot rebuild first so the
 * change is actually visible once the UI refetches.
 */
async function writeThenResnapshot(writeFn) {
  const result = await writeFn();
  await priceGuardApi.runSnapshotNow();
  return result;
}

export function useApprovePriceGuardMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, competitor }) => writeThenResnapshot(() => priceGuardApi.approveMatch({ sku, competitor })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, 'matches'] })
  });
}

export function useSavePriceGuardManualOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => writeThenResnapshot(() => priceGuardApi.saveManualOverride(params)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, 'matches'] })
  });
}

export function useTriggerPriceGuardRematch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku }) => priceGuardApi.triggerRematch({ sku }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, 'matches'] })
  });
}

/** No {error,...} wrapper on this endpoint — the raw settings object comes back as-is. */
export function usePriceGuardSettings() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'settings'],
    queryFn: priceGuardApi.getSettings,
    enabled,
    staleTime
  });
}

/**
 * Response is a bare boolean (true/false), not {success:true} — resolves to
 * that boolean directly; callers should treat any non-throwing result as success.
 */
export function useSavePriceGuardSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings) => priceGuardApi.saveSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, 'settings'] })
  });
}

export function usePriceGuardPendingRecommendations() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'pendingRecommendations'],
    queryFn: priceGuardApi.getPendingRecommendations,
    enabled,
    staleTime
  });
}

export function usePriceGuardRecommendationHistory() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'recommendationHistory'],
    queryFn: priceGuardApi.getRecommendationHistory,
    enabled,
    staleTime
  });
}

/** Casts the raw BigQuery string fields to numbers — see castMetricNumbers above. */
export function usePriceGuardProductMetrics(sku) {
  const enabled = useApiConfigured() && Boolean(sku);
  return useQuery({
    queryKey: [KEY, 'productMetrics', sku],
    queryFn: async () => {
      const res = await priceGuardApi.getProductMetrics(sku);
      return { ...res, metrics: castMetricNumbers(res.metrics) };
    },
    enabled,
    staleTime
  });
}

function invalidateRecommendations(queryClient) {
  queryClient.invalidateQueries({ queryKey: [KEY, 'pendingRecommendations'] });
  queryClient.invalidateQueries({ queryKey: [KEY, 'recommendationHistory'] });
}

export function useSubmitPriceGuardRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => writeThenResnapshot(() => priceGuardApi.submitRecommendation(params)),
    onSuccess: () => invalidateRecommendations(queryClient)
  });
}

export function useApprovePriceGuardRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => writeThenResnapshot(() => priceGuardApi.approveRecommendation(id)),
    onSuccess: () => invalidateRecommendations(queryClient)
  });
}

export function useApprovePriceGuardRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids) => writeThenResnapshot(() => priceGuardApi.approveRecommendations(ids)),
    onSuccess: () => invalidateRecommendations(queryClient)
  });
}

export function useRejectPriceGuardRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => writeThenResnapshot(() => priceGuardApi.rejectRecommendation(id)),
    onSuccess: () => invalidateRecommendations(queryClient)
  });
}

/** Slow — full pipeline (BigQuery + GitHub dispatch + email). Lives on the Settings page. */
export function useRunPriceGuardDailySync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: priceGuardApi.runDailySync,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] })
  });
}

export function usePriceGuardPipelineStatus() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: [KEY, 'pipelineStatus'],
    queryFn: priceGuardApi.getPipelineStatus,
    enabled,
    staleTime
  });
}

/** Fast refresh — used by the Dashboard's "Run Sync Job" button. */
export function useRunPriceGuardSnapshotNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: priceGuardApi.runSnapshotNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] })
  });
}
