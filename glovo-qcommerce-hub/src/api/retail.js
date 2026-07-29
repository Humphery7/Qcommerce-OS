import { useQuery } from '@tanstack/react-query';
import { getRetailHomeMetrics } from '../mock/retailHomeMetrics';

// Mirrors src/api/mfc.js's pattern. No Retail BigQuery endpoint exists
// yet, so this resolves mock data — once one does, add a
// `getRetailHomeMetrics` entry to an eventual `retailApi` object (same
// shape as `mfcApi` in api/mfc.js) and swap the queryFn below for it
// plus an `enabled: useApiConfigured()` guard. RetailHomePage already
// reads this hook's `data` in the shape src/mock/retailHomeMetrics.js
// documents, so no page changes needed.
async function getRetailHomeMetricsMock() {
  return getRetailHomeMetrics();
}

export function useRetailHomeMetrics() {
  return useQuery({
    queryKey: ['retail', 'homeMetrics', 'mock'],
    queryFn: getRetailHomeMetricsMock,
    staleTime: 60 * 1000
  });
}
