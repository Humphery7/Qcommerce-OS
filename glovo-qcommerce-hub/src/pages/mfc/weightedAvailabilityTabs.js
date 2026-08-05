export const WEIGHTED_AVAILABILITY_TABS = [
  { to: '/mfc/weighted-availability/dashboard', label: 'Dashboard' },
  { to: '/mfc/weighted-availability/summary', label: 'Supplier Summary' },
  { to: '/mfc/weighted-availability/products', label: 'Products' },
  { to: '/mfc/weighted-availability/forecast', label: 'Product Forecast' },
  { to: '/mfc/weighted-availability/recommendations', label: 'Recommendations' },
  // Prices aren't duplicated — this points at the same shared Ultrafresh
  // Availability prices route/page rather than a second copy.
  { to: '/mfc/suppliers/prices', label: 'Recommend Prices' }
];
