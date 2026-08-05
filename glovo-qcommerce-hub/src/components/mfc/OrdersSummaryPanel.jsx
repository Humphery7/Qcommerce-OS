import clsx from 'clsx';
import EmptyState from '../ui/EmptyState';

function formatNumber(n) {
  if (n === null || n === undefined) return '\u2014';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function safeGrowthPct(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function Stat({ label, value, tone }) {
  const toneClass = tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-error' : 'text-on-surface';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-secondary uppercase tracking-wide">{label}</span>
      <span className={clsx('text-[16px] font-semibold tabular-nums', toneClass)}>{value}</span>
    </div>
  );
}

function OrdersSegmentCard({ icon, label, yesterday, current, currentLabel, runRate, runRateLabel, growthPct }) {
  const growthTone = growthPct === null ? null : growthPct > 0 ? 'up' : growthPct < 0 ? 'down' : null;
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 flex flex-col gap-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-accent-container text-[18px]">{icon}</span>
        <h4 className="text-[13px] font-semibold text-on-surface">{label}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Yesterday" value={formatNumber(yesterday)} />
        <Stat label={currentLabel} value={formatNumber(current)} />
        <Stat label={runRateLabel} value={runRate === null ? '\u2014' : formatNumber(runRate)} />
        <Stat label="Growth vs Prior" value={growthPct === null ? '\u2014' : `${growthPct > 0 ? '+' : ''}${growthPct.toFixed(1)}%`} tone={growthTone} />
      </div>
    </div>
  );
}

export default function OrdersSummaryPanel({ orders, period }) {
  if (!orders) return <EmptyState message="No order data available yet." />;

  const isWeekly = period === 'weekly';
  const currentLabel = isWeekly ? 'Current Week' : 'Month to Date';
  const runRateLabel = isWeekly ? 'Week Run Rate' : 'Month Run Rate';

  const segments = [
    { key: 'total', icon: 'summarize', label: 'Total', data: orders.total, runRate: isWeekly ? orders.totalWeekRunRate : orders.totalMonthRunRate },
    { key: 'losf1', icon: 'location_on', label: 'LOSF1 (Lagos)', data: orders.losf1, runRate: null },
    { key: 'mnlf1', icon: 'location_on', label: 'MNLF1 (Manila)', data: orders.mnlf1, runRate: null }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {segments.map((s) => {
        const current = isWeekly ? s.data?.currentWeek : s.data?.monthToDate;
        const growthPct = isWeekly ? safeGrowthPct(s.data?.currentWeek, s.data?.lastWeek) : null;

        // TEMPORARY - remove once the WoW growth numbers are verified.
        console.log(`[WoW debug] ${s.label}:`, {
          currentWeek: s.data?.currentWeek,
          lastWeek: s.data?.lastWeek,
          growthPct: safeGrowthPct(s.data?.currentWeek, s.data?.lastWeek)
        });

        return (
          <OrdersSegmentCard
            key={s.key}
            icon={s.icon}
            label={s.label}
            yesterday={s.data?.yesterday}
            current={current}
            currentLabel={currentLabel}
            runRate={s.runRate}
            runRateLabel={runRateLabel}
            growthPct={growthPct}
          />
        );
      })}
    </div>
  );
}
