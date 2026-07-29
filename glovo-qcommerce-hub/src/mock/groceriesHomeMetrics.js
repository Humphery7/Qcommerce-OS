import { buildWeeklyTrend } from './mockUtils';

// Dummy data for the Groceries workspace home page
// (src/pages/groceries/GroceriesHomePage.jsx). Shape is intentionally
// close to what a `getGroceriesHomeMetrics` BigQuery endpoint should
// return — see useGroceriesHomeMetrics() in src/api/groceries.js, which
// is the single place to swap this for a real apiGet() call.
export function getGroceriesHomeMetrics() {
  return {
    lastUpdated: 'Today, 09:40',

    orders: {
      value: 968,
      unitLabel: 'today (mock)',
      deltas: [
        { label: '1D', value: 2.4 },
        { label: '1W', value: 5.1 }
      ],
      trend: [845, 880, 910, 895, 930, 950, 968]
    },

    percentInd: { value: 34.2, unit: '%', deltas: [{ label: '1W', value: 1.8 }] },

    availableSkusSpar: { value: 4210, total: 4600, unit: 'SKUs', deltas: [{ label: '1W', value: 1.1 }] },
    availableSkusMsq: { value: 3860, total: 4300, unit: 'SKUs', deltas: [{ label: '1W', value: -0.6 }] },

    replacementTopAccounts: { value: 92.6, unit: '%', deltas: [{ label: '1W', value: 0.9 }] },
    badPerformingPickers: {
      value: 6.8,
      unit: '%',
      deltas: [{ label: '1W', value: -1.2, goodDirection: 'down' }]
    },

    marketSquarePrepTime: {
      value: 11.2,
      unit: 'min',
      deltas: [{ label: '1W', value: -4.5, goodDirection: 'down' }]
    },
    marketSquareCdtp: {
      value: 28.4,
      unit: 'min',
      deltas: [{ label: '1W', value: -2.1, goodDirection: 'down' }]
    },
    prepTime: { value: 9.8, unit: 'min', deltas: [{ label: '1W', value: -3.2, goodDirection: 'down' }] },

    saidsWithPickerAccounts: { value: 612, unit: 'SAIDs', deltas: [{ label: '1W', value: 3.0 }] },
    activePickerAccounts: { value: 487, unit: 'accounts', deltas: [{ label: '1W', value: 1.6 }] },

    prepTimeTrend: buildWeeklyTrend({
      prepTime: [11.0, 10.6, 10.4, 10.1, 10.0, 9.9, 9.8],
      marketSquarePrepTime: [12.4, 12.0, 11.8, 11.6, 11.4, 11.3, 11.2]
    }),

    skuComparison: [
      { label: 'SPAR', value: 4210, color: '#8a5c00' },
      { label: 'MSQ', value: 3860, color: '#f9bd3f' }
    ],

    pickerAccountsBreakdown: [
      { label: 'Active', value: 487, color: '#00a082' },
      { label: 'Inactive', value: 125, color: '#c7cede' }
    ]
  };
}
