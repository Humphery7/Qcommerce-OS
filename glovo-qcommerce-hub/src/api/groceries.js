import { useQuery } from '@tanstack/react-query';
import { getGroceriesHomeMetrics } from '../mock/groceriesHomeMetrics';

// Mirrors src/api/mfc.js's pattern. No Groceries BigQuery endpoint
// exists yet, so this resolves mock data — once one does, add a
// `getGroceriesHomeMetrics` entry to an eventual `groceriesApi` object
// (same shape as `mfcApi` in api/mfc.js) and swap the queryFn below for
// it plus an `enabled: useApiConfigured()` guard. GroceriesHomePage
// already reads this hook's `data` in the shape
// src/mock/groceriesHomeMetrics.js documents, so no page changes needed.
async function getGroceriesHomeMetricsMock() {
  return getGroceriesHomeMetrics();
}

export function useGroceriesHomeMetrics() {
  return useQuery({
    queryKey: ['groceries', 'homeMetrics', 'mock'],
    queryFn: getGroceriesHomeMetricsMock,
    staleTime: 60 * 1000
  });
}
