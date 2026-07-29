import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '../ui/EmptyState';

export default function ComparisonBarChart({
  data,
  color = 'var(--accent)',
  height = 220,
  valueFormatter = (v) => v,
  layout = 'vertical'
}) {
  if (!data || data.length === 0) return <EmptyState message="No data available yet." />;
  const isHorizontal = layout === 'horizontal';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: isHorizontal ? 64 : 20, left: isHorizontal ? 4 : -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" horizontal={!isHorizontal} vertical={isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={valueFormatter}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              axisLine={false}
              tickLine={false}
              width={175}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              axisLine={{ stroke: 'var(--outline-variant)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={valueFormatter}
              width={36}
            />
          </>
        )}
        <Tooltip
          formatter={(value) => valueFormatter(value)}
          contentStyle={{
            borderRadius: 6,
            border: '1px solid var(--outline-variant)',
            fontSize: 12,
            background: 'var(--surface-container-lowest)',
            color: 'var(--on-surface)'
          }}
        />
        <Bar dataKey="value" radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={24}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || color} />
          ))}
          <LabelList dataKey="value" position={isHorizontal ? 'right' : 'top'} formatter={valueFormatter} style={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 500 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
