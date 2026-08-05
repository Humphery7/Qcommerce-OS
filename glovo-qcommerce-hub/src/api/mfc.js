import { apiGet, apiPost } from './client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../store/useSettingsStore';

const staleTime = 60 * 1000;

function useApiConfigured() {
  return Boolean(useSettingsStore((s) => s.apiBaseUrl));
}

export const mfcApi = {
  getDashboardData: () => apiGet('getDashboardData'),
  getSupplierSummary: () => apiGet('getSupplierSummary'),
  getSupplierList: () => apiGet('getSupplierList'),
  getProductsForSupplier: (supplierName) => apiGet('getProductsForSupplier', { supplierName }),
  getAllPrices: () => apiGet('getAllPrices'),
  getRecommendations: () => apiGet('getRecommendations'),
  addOrUpdatePrice: (priceData) => apiPost('addOrUpdatePrice', priceData),
  deletePrice: (sku, supplierId) => apiPost('deletePrice', { sku, supplierId }),
  runSnapshotNow: () => apiPost('runSnapshotNow'),

  // "Are we ordering enough?" forecasting_products_snapshot. Fetched with
  // no server-side filters — the Forecast page filters/sorts client-side,
  // the same convention every other list page in this app uses (see
  // getSupplierSummary/getAllPrices/getRecommendations consumers).
  getForecastingProducts: () => apiGet('getForecastingProducts'),

  // Weighted Availability — full mirror of the Ultrafresh Availability
  // endpoints above, reading from a different BigQuery dataset. Prices are
  // shared (not duplicated), so getAllPrices/addOrUpdatePrice/deletePrice
  // above are reused as-is, no separate entries here.
  getWeightedAvailabilityDashboardData: () => apiGet('getWeightedAvailabilityDashboardData'),
  getWeightedAvailabilitySupplierSummary: () => apiGet('getWeightedAvailabilitySupplierSummary'),
  getWeightedAvailabilitySupplierList: () => apiGet('getWeightedAvailabilitySupplierList'),
  getWeightedAvailabilityProductsForSupplier: (supplierName) => apiGet('getWeightedAvailabilityProductsForSupplier', { supplierName }),
  getWeightedAvailabilityForecastingProducts: () => apiGet('getWeightedAvailabilityForecastingProducts'),
  getWeightedAvailabilityRecommendations: () => apiGet('getWeightedAvailabilityRecommendations'),

  // MFC Nigeria reporting snapshots.
  getMfcCategorySalesReport: () => apiGet('getMfcCategorySalesReport'),
  getMfcProductSalesReport: () => apiGet('getMfcProductSalesReport'),
  getMfcOrders: () => apiGet('getMfcOrders'),
  getMfcProductThresholdReport: () => apiGet('getMfcProductThresholdReport'),
  getUserInfo: () => apiGet('getUserInfo'),

  // MFC AI intelligence: WBR-review (weekly), daily-review, monthly-review,
  // Ask-AI. The get* calls just read the last generated review (instant,
  // no Gemini call on the backend) - generation happens on a schedule or
  // via the generate*Now actions, same "precompute then read" split as
  // getDashboardData/runSnapshotNow.
  getMfcWbrReview: () => apiGet('getMfcWbrReview'),
  getMfcDailyReview: () => apiGet('getMfcDailyReview'),
  getMfcMonthlyReview: () => apiGet('getMfcMonthlyReview'),
  generateMfcWbrReviewNow: () => apiPost('generateMfcWbrReviewNow'),
  generateMfcDailyReviewNow: () => apiPost('generateMfcDailyReviewNow'),
  generateMfcMonthlyReviewNow: () => apiPost('generateMfcMonthlyReviewNow'),
  askMfcAi: (question, history) => apiPost('askMfcAi', { question, history })
};

// AvailabilityCard (src/components/mfc/AvailabilityCard.jsx) renders
// percentChange as `(percentChange * 100).toFixed(1)}pp` — it expects a raw
// 0-1 fraction, same as latestValue/prior[].value. The backend's
// {ultrafresh,losf1,mnlf1}AvailabilityCard.percentChange fields come back
// already expressed in percentage points (e.g. a real "+1.2pp" is the
// number 1.2, not 0.012), so passed straight through they render 100x too
// big ("+120.0pp" instead of "+1.2pp"). Divide back down to the fraction
// AvailabilityCard's contract expects, once here, rather than special-casing
// every consumer.
function fixAvailabilityCardPercentChange(card) {
  if (!card || !card.hasData || card.percentChange === null || card.percentChange === undefined) return card;
  return { ...card, percentChange: card.percentChange / 100 };
}

function normalizeDashboardData(data) {
  if (!data) return data;
  const fixed = { ...data };
  ['ultrafreshAvailabilityCard', 'losf1AvailabilityCard', 'mnlf1AvailabilityCard'].forEach((key) => {
    if (!fixed[key]) return;
    fixed[key] = {
      ...fixed[key],
      monthly: fixAvailabilityCardPercentChange(fixed[key].monthly),
      weekly: fixAvailabilityCardPercentChange(fixed[key].weekly)
    };
  });
  return fixed;
}

/** Powers the MFC workspace home page's Availability Trend panel — same data the Dashboard page uses. */
export function useDashboardData() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'dashboard'],
    queryFn: async () => normalizeDashboardData(await mfcApi.getDashboardData()),
    enabled,
    staleTime
  });
}

export function useSupplierSummary() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'supplierSummary'],
    queryFn: mfcApi.getSupplierSummary,
    enabled,
    staleTime
  });
}

export function useSupplierList() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'supplierList'],
    queryFn: mfcApi.getSupplierList,
    enabled,
    staleTime
  });
}

export function useProductsForSupplier(supplierName) {
  const enabled = useApiConfigured() && Boolean(supplierName);
  return useQuery({
    queryKey: ['mfc', 'productsForSupplier', supplierName],
    queryFn: () => mfcApi.getProductsForSupplier(supplierName),
    enabled,
    staleTime
  });
}

export function useAllPrices() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'allPrices'],
    queryFn: mfcApi.getAllPrices,
    enabled,
    staleTime: 30 * 1000
  });
}

export function useRecommendations() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'recommendations'],
    queryFn: mfcApi.getRecommendations,
    enabled,
    staleTime
  });
}

export function useAddOrUpdatePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mfcApi.addOrUpdatePrice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc', 'allPrices'] });
      queryClient.invalidateQueries({ queryKey: ['mfc', 'recommendations'] });
      // Prices are shared, not duplicated — the backend rebuilds BOTH
      // tools' recommendation tables on every price write (see
      // SupplierPriceService._clearDependentCaches), so both caches need
      // invalidating here too.
      queryClient.invalidateQueries({ queryKey: ['mfc', 'weightedAvailability', 'recommendations'] });
    }
  });
}

export function useDeletePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, supplierId }) => mfcApi.deletePrice(sku, supplierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc', 'allPrices'] });
      queryClient.invalidateQueries({ queryKey: ['mfc', 'recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['mfc', 'weightedAvailability', 'recommendations'] });
    }
  });
}

export function useRunSnapshotNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mfcApi.runSnapshotNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc'] });
    }
  });
}

/** "Are we ordering enough?" — forecasting_products_snapshot, full dataset (filtered client-side). */
export function useForecastingProducts() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'forecastingProducts'],
    queryFn: mfcApi.getForecastingProducts,
    enabled,
    staleTime
  });
}

/**
 * Weighted Availability — full mirror of the Ultrafresh Availability hooks
 * above (useDashboardData/useSupplierSummary/useSupplierList/
 * useProductsForSupplier/useForecastingProducts/useRecommendations), just
 * reading from the Weighted Availability endpoints and cached under their
 * own query keys so they never collide with the UF ones. Price hooks
 * (useAllPrices/useAddOrUpdatePrice/useDeletePrice) are reused as-is since
 * prices aren't duplicated.
 */
export function useWeightedAvailabilityDashboardData() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'dashboard'],
    queryFn: async () => normalizeDashboardData(await mfcApi.getWeightedAvailabilityDashboardData()),
    enabled,
    staleTime
  });
}

export function useWeightedAvailabilitySupplierSummary() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'supplierSummary'],
    queryFn: mfcApi.getWeightedAvailabilitySupplierSummary,
    enabled,
    staleTime
  });
}

export function useWeightedAvailabilitySupplierList() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'supplierList'],
    queryFn: mfcApi.getWeightedAvailabilitySupplierList,
    enabled,
    staleTime
  });
}

export function useWeightedAvailabilityProductsForSupplier(supplierName) {
  const enabled = useApiConfigured() && Boolean(supplierName);
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'productsForSupplier', supplierName],
    queryFn: () => mfcApi.getWeightedAvailabilityProductsForSupplier(supplierName),
    enabled,
    staleTime
  });
}

export function useWeightedAvailabilityForecastingProducts() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'forecastingProducts'],
    queryFn: mfcApi.getWeightedAvailabilityForecastingProducts,
    enabled,
    staleTime
  });
}

export function useWeightedAvailabilityRecommendations() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'weightedAvailability', 'recommendations'],
    queryFn: mfcApi.getWeightedAvailabilityRecommendations,
    enabled,
    staleTime
  });
}

/** mfc_category_sales_report_snapshot, full dataset. */
export function useMfcCategorySalesReport() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'categorySalesReport'],
    queryFn: mfcApi.getMfcCategorySalesReport,
    enabled,
    staleTime
  });
}

/** mfc_product_sales_report_snapshot, full dataset. */
export function useMfcProductSalesReport() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'productSalesReport'],
    queryFn: mfcApi.getMfcProductSalesReport,
    enabled,
    staleTime
  });
}

/** orders_snapshot — single-row totals (overall / LOSF1 / MNLF1). */
export function useMfcOrders() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'orders'],
    queryFn: mfcApi.getMfcOrders,
    enabled,
    staleTime
  });
}

/** mfc_product_threshold_report_snapshot, full dataset — powers "Listed Efficient SKUs". */
export function useMfcProductThresholdReport() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'productThresholdReport'],
    queryFn: mfcApi.getMfcProductThresholdReport,
    enabled,
    staleTime
  });
}

/** Last generated WBR-review (Monday 8am trigger). Instant read, no Gemini call. */
export function useMfcWbrReview() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'wbrReview'],
    queryFn: mfcApi.getMfcWbrReview,
    enabled,
    staleTime
  });
}

/** Last generated daily-review (daily 9am trigger). Instant read, no Gemini call. */
export function useMfcDailyReview() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'dailyReview'],
    queryFn: mfcApi.getMfcDailyReview,
    enabled,
    staleTime
  });
}

/** Forces a WBR-review regeneration right now (calls Gemini) — powers the page's "Regenerate" button. */
export function useRegenerateWbrReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mfcApi.generateMfcWbrReviewNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc', 'wbrReview'] });
    }
  });
}

/** Forces a daily-review regeneration right now (calls Gemini). */
export function useRegenerateDailyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mfcApi.generateMfcDailyReviewNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc', 'dailyReview'] });
    }
  });
}

/** Last generated monthly-review (1st-of-month 9am trigger). Instant read, no Gemini call. */
export function useMfcMonthlyReview() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'monthlyReview'],
    queryFn: mfcApi.getMfcMonthlyReview,
    enabled,
    staleTime
  });
}

/** Forces a monthly-review regeneration right now (calls Gemini). */
export function useRegenerateMonthlyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mfcApi.generateMfcMonthlyReviewNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfc', 'monthlyReview'] });
    }
  });
}

/**
 * Grounded, multi-turn Ask-AI question. Conversation history lives in the
 * caller's component state (this backend keeps no session state) — pass
 * the prior transcript as `history` on every call.
 */
export function useAskMfcAi() {
  return useMutation({
    mutationFn: ({ question, history }) => mfcApi.askMfcAi(question, history)
  });
}
