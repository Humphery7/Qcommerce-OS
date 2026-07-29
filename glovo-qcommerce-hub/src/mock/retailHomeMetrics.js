import { buildWeeklyTrend } from './mockUtils';

// Dummy data for the Retail workspace home page
// (src/pages/retail/RetailHomePage.jsx). Shape is intentionally close to
// what a `getRetailHomeMetrics` BigQuery endpoint should return — see
// useRetailHomeMetrics() in src/api/retail.js, which is the single place
// to swap this for a real apiGet() call.
export function getRetailHomeMetrics() {
  return {
    lastUpdated: 'Today, 09:40',

    orders: {
      value: 542,
      unitLabel: 'today (mock)',
      deltas: [
        { label: '1D', value: 1.2 },
        { label: '1W', value: 4.0 }
      ],
      trend: [470, 495, 510, 500, 525, 530, 542]
    },

    weeklyRetailOrders: {
      value: 3620,
      unit: 'orders',
      deltas: [{ label: 'vs last wk', value: 3.6 }],
      trend: [3180, 3260, 3340, 3410, 3540, 3620]
    },

    pharmacyAvailableSkus: { value: 1284, total: 1450, unit: 'SKUs', deltas: [{ label: '1W', value: 0.8 }] },
    pharmacyActivationsAbv: { value: 18, unit: 'activations', deltas: [{ label: '1W', value: 12.5 }] },
    retailAvailableSkus: { value: 2960, total: 3300, unit: 'SKUs', deltas: [{ label: '1W', value: 1.4 }] },
    medPlusSkus: { value: 876, total: 950, unit: 'SKUs', deltas: [{ label: '1W', value: -0.5 }] },

    retailCdtp: { value: 34.6, unit: 'min', deltas: [{ label: '1W', value: -1.8, goodDirection: 'down' }] },
    cdtpPurelife: { value: 31.2, unit: 'min' },
    cdtpNettPharmacy: { value: 36.8, unit: 'min' },
    cdtpMedPlus: { value: 29.5, unit: 'min' },

    ordersTrend: buildWeeklyTrend({
      orders: [470, 495, 510, 500, 525, 530, 542]
    }),

    cdtpByPartner: [
      { label: 'Purelife', value: 31.2, color: '#375aa5' },
      { label: 'Nett Pharmacy', value: 36.8, color: '#7ea1e8' },
      { label: 'MedPlus', value: 29.5, color: '#00a082' },
      { label: 'Retail Overall', value: 34.6, color: '#8a94ad' }
    ]
  };
}
