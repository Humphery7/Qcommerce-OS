import { buildWeeklyTrend } from './mockUtils';

// Dummy data for the MFC workspace home page (src/pages/mfc/MfcOverviewPage.jsx).
//
// Shape is intentionally close to what a `getMfcHomeMetrics` BigQuery
// endpoint should return — see useMfcHomeMetrics() in src/api/mfc.js,
// which is the single place to swap this for a real apiGet() call.
export function getMfcHomeMetrics() {
  return {
    lastUpdated: 'Today, 09:40',

    orders: {
      value: 1284,
      unitLabel: 'today (mock)',
      deltas: [
        { label: '1D', value: 1.9 },
        { label: '1W', value: 6.4 }
      ],
      trend: [1120, 1185, 1240, 1190, 1305, 1260, 1284]
    },

    ufAvailability: {
      daily: { value: 92.4, deltaPct: 1.2, trend: [90.1, 91.0, 90.6, 91.8, 92.0, 91.5, 92.4] },
      weekly: { value: 90.8, deltaPct: -0.6, trend: [91.9, 91.2, 90.5, 91.0, 90.2, 90.8] },
      monthly: { value: 91.5, deltaPct: 2.1, trend: [88.4, 89.0, 89.8, 90.6, 91.0, 91.5] },
      forecast: { value: 93.0, deltaPct: 1.5, trend: [91.5, 91.9, 92.2, 92.5, 92.8, 93.0], note: 'Projected, next 7 days' }
    },

    availability: {
      value: 88.7,
      deltas: [{ label: '1W', value: -1.4 }],
      byLocation: [
        { label: 'LOSF1 (Lagos)', value: 90.1 },
        { label: 'MNLF1 (Manila)', value: 87.2 }
      ]
    },

    nsfr: {
      value: 95.2,
      unit: '%',
      deltas: [{ label: '1W', value: 0.4 }],
      trend: [93.8, 94.1, 94.5, 94.7, 94.9, 95.0, 95.2]
    },

    listedEfficientSkus: {
      value: 1846,
      total: 2210,
      pct: 83.5,
      deltas: [{ label: '1W', value: 2.3 }],
      breakdown: [
        { label: 'Efficient', value: 1846, color: '#00a082' },
        { label: 'Needs Review', value: 268, color: '#f9bd3f' },
        { label: 'Delisted', value: 96, color: '#c7cede' }
      ]
    },

    margin: {
      value: 18.6,
      unit: '%',
      deltas: [{ label: '1W', value: 0.8 }],
      trend: [17.1, 17.5, 17.9, 18.0, 18.3, 18.4, 18.6]
    },

    promoContribution: {
      value: 22.4,
      unit: '%',
      deltas: [{ label: '1W', value: 3.1 }],
      trend: [18.9, 19.5, 20.2, 20.8, 21.4, 21.9, 22.4]
    },

    awaitingTime: {
      value: 6.4,
      unit: 'min',
      deltas: [{ label: '1W', value: -8.2, goodDirection: 'down' }],
      trend: [7.4, 7.2, 7.0, 6.9, 6.7, 6.6, 6.4]
    },

    weeklyTrend: buildWeeklyTrend({
      availability: [86.9, 87.4, 87.9, 88.1, 88.4, 88.6, 88.7],
      ufAvailability: [90.1, 91.0, 90.6, 91.8, 92.0, 91.5, 92.4]
    }),

    locations: [
      { id: 'losf1', label: 'LOSF1 (Lagos)', orders: 812, availability: 90.1, fillRate: 0.93, margin: 19.1 },
      { id: 'mnlf1', label: 'MNLF1 (Manila)', orders: 472, availability: 87.2, fillRate: 0.89, margin: 17.8 }
    ]
  };
}
