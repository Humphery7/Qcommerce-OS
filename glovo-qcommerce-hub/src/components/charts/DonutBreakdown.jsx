import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import EmptyState from '../ui/EmptyState';

export default function DonutBreakdown({ data, centerLabel, centerValue, size = 140, valueFormatter = (v) => v }) {
  if (!data || data.length === 0) return <EmptyState message="No breakdown data available yet." />;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div style={{ width: size, height: size }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [valueFormatter(value), name]}
              contentStyle={{
                borderRadius: 6,
                border: '1px solid var(--outline-variant)',
                fontSize: 11,
                background: 'var(--surface-container-lowest)',
                color: 'var(--on-surface)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
            {centerValue !== undefined && (
              <span className="text-[18px] font-semibold text-on-surface leading-none tabular-nums">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[9px] text-secondary uppercase tracking-wide mt-0.5">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 w-full">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-[12px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-on-surface truncate flex-1">{d.label}</span>
            <span className="font-semibold text-on-surface tabular-nums shrink-0">{valueFormatter(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
