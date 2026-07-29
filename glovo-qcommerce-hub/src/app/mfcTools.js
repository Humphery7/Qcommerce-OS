// Real tools that exist today, wired to the live REST API. Kept as data
// (not JSX inline in the page) so the Home hub's "Active Tools" count and
// the MFC Overview page's tool cards can't drift out of sync, and so
// adding a 6th MFC tool later is a one-entry change.
export const MFC_TOOLS = [
  // {
  //   id: 'dashboard',
  //   to: '/mfc/dashboard',
  //   icon: 'monitoring',
  //   title: 'Operations Dashboard',
  //   description: 'Availability trends, fill-rate KPIs, and top/bottom supplier performance at a glance.',
  //   focusArea: 'Availability Tracking',
  //   status: 'Operational'
  // },
  {
    id: 'suppliers',
    to: '/mfc/suppliers',
    icon: 'factory',
    title: 'Ultrafresh Availability',
    description: 'Ultra fresh availability and every supplier\u2019s ordered/received quantity and fill rate, monthly or weekly.',
    focusArea: 'Ultrafresh Availability',
    status: 'Operational'
  },
  // {
  //   id: 'recommendations',
  //   to: '/mfc/recommendations',
  //   icon: 'trending_up',
  //   title: 'Recommendation Engine',
  //   description: 'Top 3 recommended suppliers per product, blending fill rate and price.',
  //   focusArea: 'Margin Protection',
  //   status: 'Operational'
  // },
  {
    id: 'prices',
    to: '/mfc/prices',
    icon: 'payments',
    title: 'Price Guard',
    description: 'View and manage recommended supplier trade prices for the recommendation engine.',
    focusArea: 'Price Intelligence',
    status: 'Operational'
  }
];
