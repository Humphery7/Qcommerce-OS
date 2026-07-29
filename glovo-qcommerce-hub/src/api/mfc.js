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

  // MFC Nigeria reporting snapshots.
  getMfcCategorySalesReport: () => apiGet('getMfcCategorySalesReport'),
  getMfcProductSalesReport: () => apiGet('getMfcProductSalesReport'),
  getMfcOrders: () => apiGet('getMfcOrders'),
  getMfcProductThresholdReport: () => apiGet('getMfcProductThresholdReport'),
  getUserInfo: () => apiGet('getUserInfo')
};

/** Powers the MFC workspace home page's Availability Trend panel — same data the Dashboard page uses. */
export function useDashboardData() {
  const enabled = useApiConfigured();
  return useQuery({
    queryKey: ['mfc', 'dashboard'],
    queryFn: mfcApi.getDashboardData,
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
