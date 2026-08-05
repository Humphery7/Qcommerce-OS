import { Bar, CartesianGrid, ComposedChart, Line, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '../ui/EmptyState';

/** Dual-axis bar (left axis) + line (right axis) combo — e.g. revenue vs. margin %. */
export default function PricingMetricsChart({
  data,
  barKey = 'revenue',
  barName = 'Revenue',
  lineKey = 'margin',
  lineName = 'Margin %',
  barColor = '#6366F1',
  lineColor = '#00A082',
  height = 320,
  barValueFormatter = (v) => v,
  lineValueFormatter = (v) => `${v}%`
}) {
  if (!data || data.length === 0) return <EmptyState message="No pricing metrics data available yet." />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
          axisLine={{ stroke: 'var(--outline-variant)' }}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={barValueFormatter}
          width={54}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={lineValueFormatter}
          width={46}
        />
        <Tooltip
          formatter={(value, name) => (name === barName ? [barValueFormatter(value), name] : [lineValueFormatter(value), name])}
          contentStyle={{
            borderRadius: 6,
            border: '1px solid var(--outline-variant)',
            fontSize: 12,
            background: 'var(--surface-container-lowest)',
            color: 'var(--on-surface)'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey={barKey} name={barName} fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={lineKey}
          name={lineName}
          stroke={lineColor}
          strokeWidth={2}
          dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
