// Shared helpers for the dummy/mock data modules under src/mock/.
//
// These modules exist purely to unblock the UI while BigQuery isn't
// connected yet. Every mock module is deliberately static (not
// randomized) so the dashboard looks the same on every load instead of
// jittering — once a real endpoint exists, swap the resolver in the
// matching src/api/*.js hook for a real apiGet() call; nothing in any
// page component needs to change, since pages only ever read the shape
// documented in each mock file's comments.

export const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Builds a 7-point {label, ...seriesValues} trend array from parallel value arrays. */
export function buildWeeklyTrend(seriesMap) {
  return WEEK_LABELS.map((label, i) => {
    const point = { label };
    Object.entries(seriesMap).forEach(([key, values]) => {
      point[key] = values[i];
    });
    return point;
  });
}
